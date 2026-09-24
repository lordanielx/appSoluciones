import { randomUUID } from 'node:crypto';
import { auth, createTestApp, createUser, login, seedCatalog, uniqueNit, type TestContext } from './helpers';

jest.setTimeout(60_000);

describe('Sincronización offline (outbox)', () => {
  let ctx: TestContext;
  let admin: string;
  let tech: string;
  let techId: string;
  let otherTech: string;
  let workOrderId: string;
  let responses: { id: string; version: number; label: string }[];

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, (await createUser(ctx.prisma, 'ADMIN')).email);
    const t = await createUser(ctx.prisma, 'TECHNICIAN', 'Offline');
    techId = t.id;
    tech = await login(ctx, t.email);
    otherTech = await login(ctx, (await createUser(ctx.prisma, 'TECHNICIAN', 'Otro')).email);
    const { brand, generalType } = await seedCatalog(ctx.prisma);
    const client = await ctx.http().post('/api/v1/clients').set(auth(admin)).send({ legalName: 'Alimentos del Norte S.A.S.', nit: uniqueNit() }).expect(201);
    const tpl = await ctx.http().post('/api/v1/checklist-templates').set(auth(admin)).send({
      name: 'Visita', items: [{ label: 'Área despejada', responseType: 'BOOLEAN' }, { label: 'Temperatura ambiente', responseType: 'NUMBER', unit: '°C' }],
    }).expect(201);
    const wo = await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send({
      clientId: client.body.id, representedCompanyId: brand.id, checklistTemplateId: tpl.body.id, serviceTypeId: generalType.id,
      title: 'Visita técnica', assignNow: true, assignedTechnicianId: techId,
    }).expect(201);
    workOrderId = wo.body.id;
  });

  afterAll(async () => {
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  const op = (type: string, payload: Record<string, unknown> = {}, entityId?: string) => ({
    clientOperationId: randomUUID(),
    type,
    workOrderId,
    entityId,
    payload,
    createdAt: new Date().toISOString(),
  });

  it('descarga las órdenes activas del técnico', async () => {
    const res = await ctx.http().get('/api/v1/sync/pull').set(auth(tech)).expect(200);
    const bundle = res.body.bundles.find((b: { workOrder: { id: string } }) => b.workOrder.id === workOrderId);
    expect(bundle.checklist).toHaveLength(2);
    responses = bundle.checklist;
    const other = await ctx.http().get('/api/v1/sync/pull').set(auth(otherTech)).expect(200);
    expect(other.body.bundles).toHaveLength(0);
  });

  it('aplica operaciones en orden y no duplica al reenviar el lote', async () => {
    const ops = [
      op('WORK_ORDER_ACCEPT'),
      op('WORK_ORDER_START'),
      op('CHECKLIST_RESPONSE_UPDATE', { value: true, observation: null, baseVersion: 1 }, responses[0]!.id),
      op('CHECKLIST_RESPONSE_UPDATE', { value: 31.5, observation: 'Medido con termómetro', baseVersion: 1 }, responses[1]!.id),
      op('WORK_ORDER_NOTES', { technicianNotes: 'Visita realizada sin novedad.' }),
    ];
    const first = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({ operations: ops }).expect(200);
    expect(first.body.results.map((r: { status: string }) => r.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED']);

    const auditBefore = await ctx.prisma.auditLog.count({ where: { workOrderId } });
    const retry = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({ operations: ops }).expect(200);
    expect(retry.body.results.map((r: { status: string }) => r.status)).toEqual(['DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE']);
    expect(await ctx.prisma.auditLog.count({ where: { workOrderId } })).toBe(auditBefore);

    const wo = await ctx.prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(wo.status).toBe('IN_PROGRESS');
    const r = await ctx.prisma.checklistResponse.findUniqueOrThrow({ where: { id: responses[1]!.id } });
    expect(r.value).toBe(31.5);
    expect(r.version).toBe(2);
  });

  it('una transición ya aplicada con otro id de operación se reporta como duplicada', async () => {
    const res = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({ operations: [op('WORK_ORDER_START')] }).expect(200);
    expect(res.body.results[0].status).toBe('DUPLICATE');
  });

  it('detecta conflicto de versión y no sobrescribe en silencio', async () => {
    // Otro dispositivo modificó la respuesta (versión 2 → 3)
    await ctx.http().patch(`/api/v1/work-orders/${workOrderId}/checklist/responses/${responses[1]!.id}`).set(auth(tech)).send({ value: 29, baseVersion: 2 }).expect(200);
    const res = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({
      operations: [op('CHECKLIST_RESPONSE_UPDATE', { value: 35, observation: null, baseVersion: 2 }, responses[1]!.id)],
    }).expect(200);
    expect(res.body.results[0]).toMatchObject({ status: 'CONFLICT', errorCode: 'VERSION_CONFLICT', message: 'Esta orden fue modificada desde otro dispositivo.' });
    expect(res.body.results[0].data.server.value).toBe(29);
    const kept = await ctx.prisma.checklistResponse.findUniqueOrThrow({ where: { id: responses[1]!.id } });
    expect(kept.value).toBe(29);

    // El técnico elige conservar su valor
    const forced = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({
      operations: [op('CHECKLIST_RESPONSE_UPDATE', { value: 35, observation: null, baseVersion: 2, force: true }, responses[1]!.id)],
    }).expect(200);
    expect(forced.body.results[0].status).toBe('APPLIED');
  });

  it('rechaza el envío incompleto con la lista de pendientes', async () => {
    const res = await ctx.http().post('/api/v1/sync/batch').set(auth(tech)).send({ operations: [op('WORK_ORDER_SUBMIT')] }).expect(200);
    expect(res.body.results[0].status).toBe('REJECTED');
    expect(res.body.results[0].errorCode).toBe('WORK_ORDER_INCOMPLETE');
    expect(res.body.results[0].data.issues.map((i: { message: string }) => i.message)).toContain('Falta la firma del técnico.');
  });

  it('otro técnico no puede operar la orden', async () => {
    const res = await ctx.http().post('/api/v1/sync/batch').set(auth(otherTech)).send({
      operations: [op('CHECKLIST_RESPONSE_UPDATE', { value: false, baseVersion: 1 }, responses[0]!.id)],
    }).expect(200);
    expect(res.body.results[0]).toMatchObject({ status: 'REJECTED', errorCode: 'NOT_FOUND' });
  });
});
