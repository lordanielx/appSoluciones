import { beforeEach, describe, expect, it } from 'vitest';
import { SyncOperationType, SyncStatus } from '@meca/shared';
import { db } from './db';
import { enqueue } from './outbox';

describe('outbox local', () => {
  beforeEach(async () => {
    await db.outbox.clear();
  });

  it('asigna un clientOperationId único a cada operación', async () => {
    const a = await enqueue({ operationType: SyncOperationType.WORK_ORDER_ACCEPT, entityType: 'WORK_ORDER', workOrderId: 'w1' });
    const b = await enqueue({ operationType: SyncOperationType.WORK_ORDER_START, entityType: 'WORK_ORDER', workOrderId: 'w1' });
    expect(a).not.toBe(b);
    const ops = await db.outbox.orderBy('createdAt').toArray();
    expect(ops.map((o) => o.status)).toEqual([SyncStatus.PENDING, SyncStatus.PENDING]);
  });

  it('fusiona ediciones sucesivas de la misma respuesta conservando la versión base original', async () => {
    const base = { operationType: SyncOperationType.CHECKLIST_RESPONSE_UPDATE, entityType: 'CHECKLIST_RESPONSE' as const, entityId: 'r1', workOrderId: 'w1' };
    const first = await enqueue({ ...base, payload: { value: 'GOOD', observation: null, baseVersion: 1 } });
    const second = await enqueue({ ...base, payload: { value: 'CRITICAL', observation: 'Fuga', baseVersion: 3 } });
    expect(second).toBe(first);
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.payload).toEqual({ value: 'CRITICAL', observation: 'Fuga', baseVersion: 1 });
  });

  it('no fusiona operaciones que ya se están enviando', async () => {
    const base = { operationType: SyncOperationType.CHECKLIST_RESPONSE_UPDATE, entityType: 'CHECKLIST_RESPONSE' as const, entityId: 'r2', workOrderId: 'w1' };
    const first = await enqueue({ ...base, payload: { value: 1, baseVersion: 1 } });
    await db.outbox.update(first, { status: SyncStatus.SYNCING });
    const second = await enqueue({ ...base, payload: { value: 2, baseVersion: 1 } });
    expect(second).not.toBe(first);
    expect(await db.outbox.count()).toBe(2);
  });
});
