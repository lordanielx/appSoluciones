import { WorkOrderStatus as S, type WorkOrderStatus } from './enums';
import { Permission } from './permissions';

/**
 * Máquina de estados explícita de la Orden de Trabajo.
 * Cada acción define desde qué estados puede ejecutarse, a qué estado lleva y qué
 * permiso requiere. No existe otra forma de cambiar `status`.
 */
export const WorkOrderAction = {
  ASSIGN: 'ASSIGN',
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  START: 'START',
  SUBMIT: 'SUBMIT',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  APPROVE: 'APPROVE',
  CLOSE: 'CLOSE',
  CANCEL: 'CANCEL',
} as const;
export type WorkOrderAction = (typeof WorkOrderAction)[keyof typeof WorkOrderAction];

export interface TransitionRule {
  from: readonly WorkOrderStatus[];
  to: WorkOrderStatus;
  permission: Permission;
  /** Si es true, solo el técnico asignado puede ejecutarla. */
  assigneeOnly: boolean;
}

export const TRANSITIONS: Readonly<Record<WorkOrderAction, TransitionRule>> = {
  ASSIGN: {
    from: [S.DRAFT, S.ASSIGNED, S.REJECTED, S.ACCEPTED],
    to: S.ASSIGNED,
    permission: Permission.WORK_ORDERS_ASSIGN,
    assigneeOnly: false,
  },
  ACCEPT: {
    from: [S.ASSIGNED],
    to: S.ACCEPTED,
    permission: Permission.WORK_ORDERS_EXECUTE,
    assigneeOnly: true,
  },
  REJECT: {
    from: [S.ASSIGNED],
    to: S.REJECTED,
    permission: Permission.WORK_ORDERS_EXECUTE,
    assigneeOnly: true,
  },
  START: {
    from: [S.ACCEPTED, S.CHANGES_REQUESTED],
    to: S.IN_PROGRESS,
    permission: Permission.WORK_ORDERS_EXECUTE,
    assigneeOnly: true,
  },
  SUBMIT: {
    from: [S.IN_PROGRESS, S.CHANGES_REQUESTED],
    to: S.PENDING_REVIEW,
    permission: Permission.WORK_ORDERS_EXECUTE,
    assigneeOnly: true,
  },
  REQUEST_CHANGES: {
    from: [S.PENDING_REVIEW, S.APPROVED],
    to: S.CHANGES_REQUESTED,
    permission: Permission.WORK_ORDERS_REVIEW,
    assigneeOnly: false,
  },
  APPROVE: {
    from: [S.PENDING_REVIEW],
    to: S.APPROVED,
    permission: Permission.WORK_ORDERS_REVIEW,
    assigneeOnly: false,
  },
  CLOSE: {
    from: [S.APPROVED],
    to: S.CLOSED,
    permission: Permission.WORK_ORDERS_MANAGE,
    assigneeOnly: false,
  },
  CANCEL: {
    from: [
      S.DRAFT,
      S.ASSIGNED,
      S.ACCEPTED,
      S.REJECTED,
      S.IN_PROGRESS,
      S.PENDING_REVIEW,
      S.CHANGES_REQUESTED,
    ],
    to: S.CANCELLED,
    permission: Permission.WORK_ORDERS_MANAGE,
    assigneeOnly: false,
  },
};

export function canTransition(action: WorkOrderAction, from: WorkOrderStatus): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(action: WorkOrderAction, from: WorkOrderStatus): WorkOrderStatus | null {
  return canTransition(action, from) ? TRANSITIONS[action].to : null;
}

export interface ActionContext {
  status: WorkOrderStatus;
  permissions: readonly Permission[];
  isAssignee: boolean;
}

/** Acciones que un usuario puede ejecutar en este momento sobre la orden. */
export function availableActions(ctx: ActionContext): WorkOrderAction[] {
  return (Object.keys(TRANSITIONS) as WorkOrderAction[]).filter((action) => {
    const rule = TRANSITIONS[action];
    if (!rule.from.includes(ctx.status)) return false;
    if (!ctx.permissions.includes(rule.permission)) return false;
    if (rule.assigneeOnly && !ctx.isAssignee) return false;
    return true;
  });
}

/** Mensaje en español que explica por qué no se puede ejecutar la acción. */
export const INVALID_TRANSITION_MESSAGES: Readonly<Record<WorkOrderAction, string>> = {
  ASSIGN: 'La orden no puede asignarse en su estado actual.',
  ACCEPT: 'Solo se puede aceptar una orden que está asignada.',
  REJECT: 'Solo se puede rechazar una orden que está asignada.',
  START: 'La orden debe estar aceptada antes de iniciar el servicio.',
  SUBMIT: 'Solo se puede enviar a revisión un servicio en ejecución.',
  REQUEST_CHANGES: 'Solo se pueden solicitar correcciones a una orden en revisión o aprobada.',
  APPROVE: 'Solo se puede aprobar una orden pendiente de revisión.',
  CLOSE: 'Solo se puede cerrar una orden aprobada.',
  CANCEL: 'La orden ya no puede anularse.',
};
