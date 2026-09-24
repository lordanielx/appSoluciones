/**
 * Enumeraciones del dominio. Se definen como objetos `as const` para que el mismo
 * valor sirva en runtime (validación, UI) y como tipo, y sean compatibles con los
 * enums que genera Prisma (uniones de literales).
 */

export const Role = {
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  TECHNICIAN: 'TECHNICIAN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const WorkOrderStatus = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

/** Estados en los que la orden está "abierta" (no terminada ni anulada). */
export const OPEN_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.DRAFT,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.ACCEPTED,
  WorkOrderStatus.REJECTED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.PENDING_REVIEW,
  WorkOrderStatus.CHANGES_REQUESTED,
];

/** Estados en los que el técnico puede editar checklist, evidencias y firmas. */
export const TECHNICIAN_EDITABLE_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.CHANGES_REQUESTED,
];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ResponseType = {
  BOOLEAN: 'BOOLEAN',
  TEXT: 'TEXT',
  LONG_TEXT: 'LONG_TEXT',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  MULTISELECT: 'MULTISELECT',
  STATUS: 'STATUS',
} as const;
export type ResponseType = (typeof ResponseType)[keyof typeof ResponseType];

export const StatusValue = {
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  NEEDS_INTERVENTION: 'NEEDS_INTERVENTION',
  CRITICAL: 'CRITICAL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;
export type StatusValue = (typeof StatusValue)[keyof typeof StatusValue];

/** Resultados STATUS que exigen observación (ver ASSUMPTIONS A-10). */
export const STATUS_VALUES_REQUIRING_OBSERVATION: readonly StatusValue[] = [
  StatusValue.NEEDS_INTERVENTION,
  StatusValue.CRITICAL,
];

export const SignatureType = {
  TECHNICIAN: 'TECHNICIAN',
  CLIENT: 'CLIENT',
} as const;
export type SignatureType = (typeof SignatureType)[keyof typeof SignatureType];

export const ReportStatus = {
  APPROVED: 'APPROVED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const SyncStatus = {
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  ERROR: 'ERROR',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const AuditAction = {
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  AUTH_PASSWORD_RESET: 'AUTH_PASSWORD_RESET',
  AUTH_REFRESH_REUSE_DETECTED: 'AUTH_REFRESH_REUSE_DETECTED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  EQUIPMENT_CREATED: 'EQUIPMENT_CREATED',
  EQUIPMENT_UPDATED: 'EQUIPMENT_UPDATED',
  BRAND_PROFILE_CREATED: 'BRAND_PROFILE_CREATED',
  BRAND_PROFILE_UPDATED: 'BRAND_PROFILE_UPDATED',
  SERVICE_TYPE_CREATED: 'SERVICE_TYPE_CREATED',
  SERVICE_TYPE_UPDATED: 'SERVICE_TYPE_UPDATED',
  CHECKLIST_TEMPLATE_CREATED: 'CHECKLIST_TEMPLATE_CREATED',
  CHECKLIST_TEMPLATE_UPDATED: 'CHECKLIST_TEMPLATE_UPDATED',
  WORK_ORDER_CREATED: 'WORK_ORDER_CREATED',
  WORK_ORDER_UPDATED: 'WORK_ORDER_UPDATED',
  WORK_ORDER_ASSIGNED: 'WORK_ORDER_ASSIGNED',
  WORK_ORDER_ACCEPTED: 'WORK_ORDER_ACCEPTED',
  WORK_ORDER_REJECTED: 'WORK_ORDER_REJECTED',
  WORK_ORDER_STARTED: 'WORK_ORDER_STARTED',
  CHECKLIST_UPDATED: 'CHECKLIST_UPDATED',
  EVIDENCE_ADDED: 'EVIDENCE_ADDED',
  EVIDENCE_REMOVED: 'EVIDENCE_REMOVED',
  SIGNATURE_ADDED: 'SIGNATURE_ADDED',
  CLIENT_SIGNATURE_WAIVED: 'CLIENT_SIGNATURE_WAIVED',
  WORK_ORDER_SUBMITTED: 'WORK_ORDER_SUBMITTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REPORT_GENERATED: 'REPORT_GENERATED',
  WORK_ORDER_APPROVED: 'WORK_ORDER_APPROVED',
  WORK_ORDER_CLOSED: 'WORK_ORDER_CLOSED',
  WORK_ORDER_CANCELLED: 'WORK_ORDER_CANCELLED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const EntityType = {
  USER: 'USER',
  CLIENT: 'CLIENT',
  EQUIPMENT: 'EQUIPMENT',
  BRAND_PROFILE: 'BRAND_PROFILE',
  SERVICE_TYPE: 'SERVICE_TYPE',
  CHECKLIST_TEMPLATE: 'CHECKLIST_TEMPLATE',
  WORK_ORDER: 'WORK_ORDER',
  CHECKLIST_RESPONSE: 'CHECKLIST_RESPONSE',
  EVIDENCE: 'EVIDENCE',
  SIGNATURE: 'SIGNATURE',
  REPORT: 'REPORT',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

/** Tipos de operación que el cliente puede encolar offline (outbox). */
export const SyncOperationType = {
  WORK_ORDER_ACCEPT: 'WORK_ORDER_ACCEPT',
  WORK_ORDER_REJECT: 'WORK_ORDER_REJECT',
  WORK_ORDER_START: 'WORK_ORDER_START',
  WORK_ORDER_SUBMIT: 'WORK_ORDER_SUBMIT',
  WORK_ORDER_NOTES: 'WORK_ORDER_NOTES',
  CHECKLIST_RESPONSE_UPDATE: 'CHECKLIST_RESPONSE_UPDATE',
  EVIDENCE_UPLOAD: 'EVIDENCE_UPLOAD',
  EVIDENCE_DELETE: 'EVIDENCE_DELETE',
  SIGNATURE_UPLOAD: 'SIGNATURE_UPLOAD',
} as const;
export type SyncOperationType = (typeof SyncOperationType)[keyof typeof SyncOperationType];

/** Operaciones que viajan en `POST /sync/batch` (JSON). Las binarias usan multipart. */
export const BATCHABLE_SYNC_OPERATIONS: readonly SyncOperationType[] = [
  SyncOperationType.WORK_ORDER_ACCEPT,
  SyncOperationType.WORK_ORDER_REJECT,
  SyncOperationType.WORK_ORDER_START,
  SyncOperationType.WORK_ORDER_SUBMIT,
  SyncOperationType.WORK_ORDER_NOTES,
  SyncOperationType.CHECKLIST_RESPONSE_UPDATE,
  SyncOperationType.EVIDENCE_DELETE,
];
