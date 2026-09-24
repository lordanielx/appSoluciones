import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AUDIT_ACTION_LABELS,
  type AuditAction,
  type EntityType,
  type HistoryEntryDto,
  type Paginated,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { RequestContext } from '../../common/context/request-context';
import { paginated, skipTake } from '../../common/util/pagination';

export interface AuditEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  workOrderId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Registro inmutable de acciones críticas (RB-015). No existe operación de borrado. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const ctx = RequestContext.get();
    await (tx ?? this.prisma).auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        workOrderId: entry.workOrderId ?? null,
        actorId: entry.actorId ?? ctx.userId ?? null,
        metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        requestId: ctx.requestId ?? null,
      },
    });
  }

  async workOrderHistory(workOrderId: string): Promise<HistoryEntryDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, fullName: true } } },
    });
    return rows.map((r) => this.toDto(r));
  }

  async list(q: {
    page: number;
    pageSize: number;
    entityId?: string;
    actorId?: string;
    action?: string;
  }): Promise<Paginated<HistoryEntryDto & { entityType: string; entityId: string; ip: string | null }>> {
    const where: Prisma.AuditLogWhereInput = {
      entityId: q.entityId,
      actorId: q.actorId,
      action: q.action,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, fullName: true } } },
        ...skipTake(q),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({ ...this.toDto(r), entityType: r.entityType, entityId: r.entityId, ip: r.ip })),
      total,
      q,
    );
  }

  toDto(r: {
    id: string;
    action: string;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    actor: { id: string; fullName: string } | null;
  }): HistoryEntryDto {
    const metadata = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      action: r.action as AuditAction,
      description: describe(r.action as AuditAction, metadata),
      actor: r.actor,
      metadata,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

function describe(action: AuditAction, m: Record<string, unknown>): string {
  const base = AUDIT_ACTION_LABELS[action] ?? action;
  const str = (k: string) => (typeof m[k] === 'string' ? (m[k] as string) : undefined);
  switch (action) {
    case 'WORK_ORDER_ASSIGNED':
      return str('technicianName') ? `Asignada a ${str('technicianName')}` : base;
    case 'WORK_ORDER_REJECTED':
    case 'WORK_ORDER_CANCELLED':
    case 'CLIENT_SIGNATURE_WAIVED':
      return str('reason') ? `${base}: ${str('reason')}` : base;
    case 'CHANGES_REQUESTED':
      return str('comment') ? `${base}: ${str('comment')}` : base;
    case 'CHECKLIST_UPDATED':
      return str('label') ? `Checklist: ${str('label')}` : base;
    case 'SIGNATURE_ADDED':
      return str('signatureType') === 'CLIENT'
        ? `Firma del cliente (${str('signerName') ?? ''})`
        : `Firma del técnico (${str('signerName') ?? ''})`;
    case 'REPORT_GENERATED':
      return `Informe ${str('reportNumber') ?? ''} versión ${String(m.version ?? '')} generado`;
    default:
      return base;
  }
}
