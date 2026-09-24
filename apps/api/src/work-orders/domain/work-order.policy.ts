import {
  Permission,
  TECHNICIAN_EDITABLE_STATUSES,
  WorkOrderStatus,
  ErrorCode,
  type Role,
} from '@meca/shared';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';

export interface WorkOrderAccessTarget {
  status: WorkOrderStatus;
  assignedTechnicianId: string | null;
}

/**
 * Reglas de acceso a una OT (RB-005, sección 33). Se evalúan SIEMPRE en el servidor.
 */
export const WorkOrderPolicy = {
  canReadAll(user: Pick<AuthenticatedUser, 'permissions'>): boolean {
    return user.permissions.includes(Permission.WORK_ORDERS_READ_ALL);
  },

  /** El técnico solo ve órdenes asignadas a él y que ya salieron de borrador. */
  canRead(user: Pick<AuthenticatedUser, 'id' | 'permissions'>, wo: WorkOrderAccessTarget): boolean {
    if (this.canReadAll(user)) return true;
    return (
      user.permissions.includes(Permission.WORK_ORDERS_READ_OWN) &&
      wo.assignedTechnicianId === user.id &&
      wo.status !== WorkOrderStatus.DRAFT
    );
  },

  isAssignee(user: Pick<AuthenticatedUser, 'id'>, wo: WorkOrderAccessTarget): boolean {
    return wo.assignedTechnicianId !== null && wo.assignedTechnicianId === user.id;
  },

  /**
   * RB-005: el técnico solo edita checklist, evidencias, firmas y notas de SU orden
   * y únicamente mientras el servicio está en ejecución o en corrección.
   */
  assertCanExecute(user: Pick<AuthenticatedUser, 'id' | 'permissions'>, wo: WorkOrderAccessTarget): void {
    if (!user.permissions.includes(Permission.WORK_ORDERS_EXECUTE) || !this.isAssignee(user, wo)) {
      throw AppException.forbidden('Solo el técnico asignado puede registrar información de este servicio.');
    }
    if (!TECHNICIAN_EDITABLE_STATUSES.includes(wo.status)) {
      throw AppException.conflict(
        ErrorCode.WORK_ORDER_NOT_EDITABLE,
        wo.status === WorkOrderStatus.ACCEPTED || wo.status === WorkOrderStatus.ASSIGNED
          ? 'Debe iniciar el servicio antes de registrar información.'
          : 'El servicio ya fue enviado o cerrado; no admite modificaciones.',
        { status: wo.status },
      );
    }
  },
};

export type { Role };
