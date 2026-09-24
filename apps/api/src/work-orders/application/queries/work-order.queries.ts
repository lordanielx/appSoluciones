import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  OPEN_WORK_ORDER_STATUSES,
  WorkOrderStatus,
  type DashboardSummary,
  type Paginated,
  type StatusHistoryDto,
  type WorkOrderBundle,
  type WorkOrderDetail,
  type WorkOrderListItem,
  type WorkOrderListQuery,
} from '@meca/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../../common/auth/auth-user';
import { AppException } from '../../../common/errors/app.exception';
import { paginated, skipTake } from '../../../common/util/pagination';
import { startOfDayBogota } from '../../../common/util/timezone';
import { WorkOrderPolicy } from '../../domain/work-order.policy';
import { detailInclude, listInclude, userRef } from '../../infrastructure/work-order.includes';
import { toDetail, toListItem } from '../work-order.mapper';
import { ExecutionMapper } from '../execution.mapper';

/** Estados que el técnico descarga para trabajar offline. */
export const TECHNICIAN_SYNC_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.ACCEPTED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.PENDING_REVIEW,
  WorkOrderStatus.CHANGES_REQUESTED,
];

@Injectable()
export class WorkOrderQueries {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mapper: ExecutionMapper,
  ) {}

  /** Filtro de visibilidad aplicado en la consulta (no después): técnico solo ve lo suyo. */
  visibilityFilter(user: AuthenticatedUser): Prisma.WorkOrderWhereInput {
    if (WorkOrderPolicy.canReadAll(user)) return {};
    return { assignedTechnicianId: user.id, status: { not: WorkOrderStatus.DRAFT } };
  }

  async list(q: WorkOrderListQuery, user: AuthenticatedUser): Promise<Paginated<WorkOrderListItem>> {
    const term = q.q?.trim();
    const where: Prisma.WorkOrderWhereInput = {
      AND: [
        this.visibilityFilter(user),
        {
          status: q.status ? { in: q.status } : undefined,
          clientId: q.clientId,
          equipmentId: q.equipmentId,
          assignedTechnicianId: q.technicianId,
          priority: q.priority,
          scheduledStart: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
        },
        term
          ? {
              OR: [
                { number: { contains: term, mode: 'insensitive' } },
                { title: { contains: term, mode: 'insensitive' } },
                { client: { legalName: { contains: term, mode: 'insensitive' } } },
                { client: { tradeName: { contains: term, mode: 'insensitive' } } },
                { equipment: { code: { contains: term, mode: 'insensitive' } } },
                { equipment: { name: { contains: term, mode: 'insensitive' } } },
                { equipment: { serial: { contains: term, mode: 'insensitive' } } },
                { assignedTechnician: { fullName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };
    const orderBy: Prisma.WorkOrderOrderByWithRelationInput =
      q.sort === 'scheduledStart'
        ? { scheduledStart: { sort: q.order, nulls: 'last' } }
        : { [q.sort]: q.order };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({ where, orderBy: [orderBy, { number: 'desc' }], include: listInclude, ...skipTake(q) }),
      this.prisma.workOrder.count({ where }),
    ]);
    return paginated(rows.map(toListItem), total, q);
  }

  async detail(id: string, user: AuthenticatedUser): Promise<WorkOrderDetail> {
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: detailInclude });
    if (!row || !WorkOrderPolicy.canRead(user, row)) throw AppException.notFound('La orden de trabajo');
    return toDetail(row, user);
  }

  async bundle(id: string, user: AuthenticatedUser): Promise<WorkOrderBundle> {
    const workOrder = await this.detail(id, user);
    const [responses, evidence, signatures, history] = await Promise.all([
      this.prisma.checklistResponse.findMany({
        where: { execution: { workOrderId: id } },
        orderBy: { order: 'asc' },
        include: { answeredBy: userRef },
      }),
      this.prisma.evidence.findMany({
        where: { workOrderId: id, deletedAt: null },
        orderBy: { uploadedAt: 'asc' },
        include: { createdBy: userRef },
      }),
      this.prisma.signature.findMany({
        where: { workOrderId: id, supersededAt: null },
        orderBy: { signedAt: 'asc' },
        include: { createdBy: userRef },
      }),
      this.statusHistory(id),
    ]);
    return {
      workOrder,
      checklist: responses.map((r) => this.mapper.response(r)),
      evidence: await Promise.all(evidence.map((e) => this.mapper.evidence(e))),
      signatures: await Promise.all(signatures.map((s) => this.mapper.signature(s))),
      statusHistory: history,
    };
  }

  /** Órdenes activas del técnico con todo lo necesario para trabajar sin conexión. */
  async technicianBundles(user: AuthenticatedUser): Promise<WorkOrderBundle[]> {
    const ids = await this.prisma.workOrder.findMany({
      where: { assignedTechnicianId: user.id, status: { in: TECHNICIAN_SYNC_STATUSES } },
      select: { id: true },
      orderBy: [{ scheduledStart: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 100,
    });
    return Promise.all(ids.map((w) => this.bundle(w.id, user)));
  }

  async statusHistory(workOrderId: string): Promise<StatusHistoryDto[]> {
    const rows = await this.prisma.workOrderStatusHistory.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'asc' },
      include: { actor: userRef },
    });
    return rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      comment: r.comment,
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async history(id: string, user: AuthenticatedUser) {
    await this.detail(id, user);
    return this.audit.workOrderHistory(id);
  }

  async dashboard(user: AuthenticatedUser): Promise<DashboardSummary> {
    const scope = this.visibilityFilter(user);
    const count = (where: Prisma.WorkOrderWhereInput) =>
      this.prisma.workOrder.count({ where: { AND: [scope, where] } });
    const today = startOfDayBogota();
    const [open, assigned, inProgress, pendingReview, changesRequested, completedToday, recent, activity] =
      await Promise.all([
        count({ status: { in: [...OPEN_WORK_ORDER_STATUSES] } }),
        count({ status: { in: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED] } }),
        count({ status: WorkOrderStatus.IN_PROGRESS }),
        count({ status: WorkOrderStatus.PENDING_REVIEW }),
        count({ status: WorkOrderStatus.CHANGES_REQUESTED }),
        count({ status: { in: [WorkOrderStatus.APPROVED, WorkOrderStatus.CLOSED] }, approvedAt: { gte: today } }),
        this.prisma.workOrder.findMany({ where: scope, orderBy: { updatedAt: 'desc' }, take: 10, include: listInclude }),
        this.prisma.auditLog.findMany({
          where: { workOrderId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { actor: userRef },
        }),
      ]);
    const woIds = [...new Set(activity.map((a) => a.workOrderId).filter((v): v is string => Boolean(v)))];
    const numbers = new Map(
      (await this.prisma.workOrder.findMany({ where: { id: { in: woIds } }, select: { id: true, number: true } })).map(
        (w) => [w.id, w.number],
      ),
    );
    return {
      counters: { open, assigned, inProgress, pendingReview, changesRequested, completedToday },
      recentWorkOrders: recent.map(toListItem),
      recentActivity: activity.map((a) => ({
        ...this.audit.toDto(a),
        workOrder: a.workOrderId ? { id: a.workOrderId, number: numbers.get(a.workOrderId) ?? '' } : null,
      })),
    };
  }
}
