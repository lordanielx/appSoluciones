import {
  type Priority,
  type ResponseType,
  type Role,
  type SignatureType,
  type StatusValue,
  type WorkOrderStatus,
  type ReportStatus,
  type AuditAction,
} from './enums';

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordinador',
  TECHNICIAN: 'Técnico',
};

export const WORK_ORDER_STATUS_LABELS: Readonly<Record<WorkOrderStatus, string>> = {
  DRAFT: 'Borrador',
  ASSIGNED: 'Asignada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  IN_PROGRESS: 'En ejecución',
  PENDING_REVIEW: 'Pendiente revisión',
  CHANGES_REQUESTED: 'Corrección solicitada',
  APPROVED: 'Aprobada',
  CLOSED: 'Cerrada',
  CANCELLED: 'Anulada',
};

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const RESPONSE_TYPE_LABELS: Readonly<Record<ResponseType, string>> = {
  BOOLEAN: 'Sí / No',
  TEXT: 'Texto corto',
  LONG_TEXT: 'Texto largo',
  NUMBER: 'Medición numérica',
  SELECT: 'Selección única',
  MULTISELECT: 'Selección múltiple',
  STATUS: 'Estado',
};

export const STATUS_VALUE_LABELS: Readonly<Record<StatusValue, string>> = {
  GOOD: 'Bueno',
  FAIR: 'Regular',
  NEEDS_INTERVENTION: 'Requiere intervención',
  CRITICAL: 'Crítico',
  NOT_APPLICABLE: 'No aplica',
};

export const SIGNATURE_TYPE_LABELS: Readonly<Record<SignatureType, string>> = {
  TECHNICIAN: 'Técnico',
  CLIENT: 'Responsable del cliente',
};

export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  APPROVED: 'Aprobado',
  SUPERSEDED: 'Reemplazado',
};

/** Texto de consentimiento para la firma del cliente (sección 19). */
export const CLIENT_SIGNATURE_CONSENT_TEXT =
  'Confirmo que la información registrada corresponde al servicio realizado y autorizo el uso de esta firma dentro del informe técnico asociado a esta orden.';

/** Descripción de eventos para el timeline de la OT. */
export const AUDIT_ACTION_LABELS: Readonly<Partial<Record<AuditAction, string>>> = {
  WORK_ORDER_CREATED: 'Orden creada',
  WORK_ORDER_UPDATED: 'Orden modificada',
  WORK_ORDER_ASSIGNED: 'Orden asignada',
  WORK_ORDER_ACCEPTED: 'Servicio aceptado',
  WORK_ORDER_REJECTED: 'Servicio rechazado',
  WORK_ORDER_STARTED: 'Servicio iniciado',
  CHECKLIST_UPDATED: 'Checklist actualizado',
  EVIDENCE_ADDED: 'Evidencia agregada',
  EVIDENCE_REMOVED: 'Evidencia retirada',
  SIGNATURE_ADDED: 'Firma registrada',
  CLIENT_SIGNATURE_WAIVED: 'Excepción de firma del cliente',
  WORK_ORDER_SUBMITTED: 'Servicio enviado para revisión',
  CHANGES_REQUESTED: 'Corrección solicitada',
  REPORT_GENERATED: 'Informe generado',
  WORK_ORDER_APPROVED: 'Informe aprobado',
  WORK_ORDER_CLOSED: 'Orden cerrada',
  WORK_ORDER_CANCELLED: 'Orden anulada',
};
