import type { Prisma } from '@prisma/client';
import {
  availableActions,
  type ResponseType,
  checklistProgress,
  type ChecklistValue,
  type WorkOrderDetail,
  type WorkOrderListItem,
} from '@meca/shared';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { iso } from '../../common/util/dates';
import { WorkOrderPolicy } from '../domain/work-order.policy';
import type { WorkOrderDetailRow, WorkOrderListRow } from '../infrastructure/work-order.includes';

interface ProgressSource {
  checklistExecution: { responses: { responseType: ResponseType; value: Prisma.JsonValue }[] } | null;
}

function progress(row: ProgressSource) {
  return checklistProgress(
    (row.checklistExecution?.responses ?? []).map((r) => ({ responseType: r.responseType, value: r.value as ChecklistValue })),
  );
}

export function toListItem(row: WorkOrderListRow): WorkOrderListItem {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduledStart: iso(row.scheduledStart),
    scheduledEnd: iso(row.scheduledEnd),
    client: row.client,
    equipment: row.equipment,
    technician: row.assignedTechnician,
    serviceType: row.serviceType,
    checklistProgress: progress(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDetail(row: WorkOrderDetailRow, user: AuthenticatedUser): WorkOrderDetail {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduledStart: iso(row.scheduledStart),
    scheduledEnd: iso(row.scheduledEnd),
    client: row.client,
    equipment: row.equipment,
    technician: row.assignedTechnician,
    serviceType: row.serviceType,
    checklistProgress: progress(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    description: row.description,
    serviceScope: row.serviceScope,
    address: row.address,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    internalNotes: WorkOrderPolicy.canReadAll(user) ? row.internalNotes : null,
    technicianNotes: row.technicianNotes,
    rejectionReason: row.rejectionReason,
    changesRequestedComment: row.changesRequestedComment,
    cancellationReason: row.cancellationReason,
    clientSignatureWaived: row.clientSignatureWaived,
    clientSignatureWaiverReason: row.clientSignatureWaiverReason,
    version: row.version,
    representedCompany: row.representedCompany,
    checklistTemplate: row.checklistTemplate,
    createdBy: row.createdBy,
    assignedAt: iso(row.assignedAt),
    acceptedAt: iso(row.acceptedAt),
    startedAt: iso(row.startedAt),
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    closedAt: iso(row.closedAt),
    cancelledAt: iso(row.cancelledAt),
    availableActions: availableActions({
      status: row.status,
      permissions: user.permissions,
      isAssignee: WorkOrderPolicy.isAssignee(user, row),
    }),
  };
}
