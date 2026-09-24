import { Injectable } from '@nestjs/common';
import type { Prisma, WorkOrder } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  INVALID_TRANSITION_MESSAGES,
  TRANSITIONS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderAction,
} from '@meca/shared';
import type { Tx } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { WorkOrderPolicy } from '../domain/work-order.policy';

export interface TransitionOptions {
  data?: Omit<Prisma.WorkOrderUncheckedUpdateInput, 'status' | 'version'>;
  comment?: string | null;
  audit: { action: AuditAction; metadata?: Record<string, unknown> };
}

/**
 * Único punto donde cambia `WorkOrder.status`. Valida la máquina de estados, el permiso
 * y la asignación; registra historial de estados y auditoría en la misma transacción.
 */
@Injectable()
export class WorkOrderTransitionsService {
  constructor(private readonly audit: AuditService) {}

  assertAllowed(action: WorkOrderAction, wo: WorkOrder, user: AuthenticatedUser): void {
    const rule = TRANSITIONS[action];
    if (!user.permissions.includes(rule.permission)) throw AppException.forbidden();
    if (rule.assigneeOnly && !WorkOrderPolicy.isAssignee(user, wo)) {
      throw AppException.forbidden('Solo el técnico asignado puede realizar esta acción.');
    }
    if (!rule.from.includes(wo.status)) {
      throw AppException.conflict(ErrorCode.WORK_ORDER_INVALID_STATE, INVALID_TRANSITION_MESSAGES[action], {
        action,
        currentStatus: wo.status,
        currentStatusLabel: WORK_ORDER_STATUS_LABELS[wo.status],
      });
    }
  }

  async apply(
    tx: Tx,
    action: WorkOrderAction,
    wo: WorkOrder,
    user: AuthenticatedUser,
    options: TransitionOptions,
  ): Promise<WorkOrder> {
    this.assertAllowed(action, wo, user);
    const to = TRANSITIONS[action].to;
    // Guardia adicional contra transiciones concurrentes: el estado no debe haber cambiado.
    const result = await tx.workOrder.updateMany({
      where: { id: wo.id, status: wo.status },
      data: { ...options.data, status: to, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw AppException.conflict(ErrorCode.VERSION_CONFLICT, 'La orden cambió de estado mientras se procesaba la acción. Actualice la vista.');
    }
    await tx.workOrderStatusHistory.create({
      data: { workOrderId: wo.id, fromStatus: wo.status, toStatus: to, comment: options.comment ?? null, actorId: user.id },
    });
    await this.audit.record(
      {
        action: options.audit.action,
        entityType: EntityType.WORK_ORDER,
        entityId: wo.id,
        workOrderId: wo.id,
        actorId: user.id,
        metadata: { from: wo.status, to, number: wo.number, ...options.audit.metadata },
      },
      tx,
    );
    return tx.workOrder.findUniqueOrThrow({ where: { id: wo.id } });
  }
}
