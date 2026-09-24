import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  WorkOrderAction,
  WorkOrderStatus,
  Permission,
} from '@meca/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../../common/auth/auth-user';
import { AppException } from '../../../common/errors/app.exception';
import { ReportsService } from '../../../reports/application/reports.service';
import { WorkOrderAccessService } from '../work-order-access.service';
import { WorkOrderTransitionsService } from '../work-order-transitions.service';
import { SubmissionEvaluator } from '../submission-evaluator.service';
import { WorkOrderPolicy } from '../../domain/work-order.policy';

/** Transacciones largas (generación de PDF dentro de la aprobación). */
const REPORT_TX_OPTIONS = { timeout: 90_000, maxWait: 10_000 } as const;

@Injectable()
export class WorkOrderLifecycleCommands {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkOrderAccessService,
    private readonly transitions: WorkOrderTransitionsService,
    private readonly evaluator: SubmissionEvaluator,
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  accept(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.ACCEPT, wo, user, {
        data: { acceptedAt: new Date() },
        audit: { action: AuditAction.WORK_ORDER_ACCEPTED },
      });
    });
  }

  reject(id: string, reason: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.REJECT, wo, user, {
        data: { rejectionReason: reason },
        comment: reason,
        audit: { action: AuditAction.WORK_ORDER_REJECTED, metadata: { reason } },
      });
    });
  }

  start(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.START, wo, user, {
        // En una corrección se conserva la hora original de inicio.
        data: { startedAt: wo.startedAt ?? new Date() },
        audit: { action: AuditAction.WORK_ORDER_STARTED, metadata: { resumed: wo.status === WorkOrderStatus.CHANGES_REQUESTED } },
      });
    });
  }

  /** RB-006..RB-010: no se envía si falta algo; se devuelve la lista exacta de pendientes. */
  submit(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      this.transitions.assertAllowed(WorkOrderAction.SUBMIT, wo, user);
      const summary = await this.evaluator.evaluate(tx, wo);
      if (!summary.canSubmit) {
        throw AppException.unprocessable(ErrorCode.WORK_ORDER_INCOMPLETE, 'No es posible enviar el servicio.', {
          issues: summary.issues,
          summary: {
            checklistComplete: summary.checklistComplete,
            evidenceComplete: summary.evidenceComplete,
            observationsComplete: summary.observationsComplete,
            technicianSigned: summary.technicianSigned,
            clientSigned: summary.clientSigned,
          },
        });
      }
      return this.transitions.apply(tx, WorkOrderAction.SUBMIT, wo, user, {
        data: { submittedAt: new Date(), changesRequestedComment: null },
        audit: { action: AuditAction.WORK_ORDER_SUBMITTED },
      });
    });
  }

  requestChanges(id: string, comment: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.REQUEST_CHANGES, wo, user, {
        data: { changesRequestedComment: comment },
        comment,
        audit: {
          action: AuditAction.CHANGES_REQUESTED,
          metadata: { comment, reopenedApproved: wo.status === WorkOrderStatus.APPROVED },
        },
      });
    });
  }

  /** Aprueba y genera el informe PDF definitivo en la misma transacción (nueva versión si ya existía). */
  approve(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      this.transitions.assertAllowed(WorkOrderAction.APPROVE, wo, user);
      const approvedAt = new Date();
      const report = await this.reports.generate(tx, wo, user, { approvedAt });
      const updated = await this.transitions.apply(tx, WorkOrderAction.APPROVE, wo, user, {
        data: { approvedAt },
        audit: {
          action: AuditAction.WORK_ORDER_APPROVED,
          metadata: { reportId: report.id, reportNumber: report.reportNumber, version: report.version },
        },
      });
      return { workOrder: updated, report };
    }, REPORT_TX_OPTIONS);
  }

  close(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.CLOSE, wo, user, {
        data: { closedAt: new Date() },
        audit: { action: AuditAction.WORK_ORDER_CLOSED },
      });
    });
  }

  cancel(id: string, reason: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      return this.transitions.apply(tx, WorkOrderAction.CANCEL, wo, user, {
        data: { cancellationReason: reason, cancelledAt: new Date() },
        comment: reason,
        audit: { action: AuditAction.WORK_ORDER_CANCELLED, metadata: { reason } },
      });
    });
  }

  /** RB-010: excepción administrativa expresa a la firma del cliente. */
  waiveClientSignature(id: string, reason: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      if (!user.permissions.includes(Permission.WORK_ORDERS_WAIVE_CLIENT_SIGNATURE)) throw AppException.forbidden();
      const allowed: WorkOrderStatus[] = [
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ACCEPTED,
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CHANGES_REQUESTED,
      ];
      if (!allowed.includes(wo.status)) {
        throw AppException.conflict(
          ErrorCode.WORK_ORDER_INVALID_STATE,
          'La excepción de firma solo puede registrarse antes de que el servicio sea enviado a revisión.',
        );
      }
      await tx.workOrder.update({
        where: { id },
        data: {
          clientSignatureWaived: true,
          clientSignatureWaiverReason: reason,
          clientSignatureWaivedById: user.id,
          version: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          action: AuditAction.CLIENT_SIGNATURE_WAIVED,
          entityType: EntityType.WORK_ORDER,
          entityId: id,
          workOrderId: id,
          actorId: user.id,
          metadata: { reason },
        },
        tx,
      );
    });
  }

  /** Observaciones y conclusiones técnicas del servicio (RB-008). */
  updateTechnicianNotes(id: string, technicianNotes: string | null, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      WorkOrderPolicy.assertCanExecute(user, wo);
      if (wo.technicianNotes === technicianNotes) return wo;
      const updated = await tx.workOrder.update({
        where: { id },
        data: { technicianNotes, version: { increment: 1 } },
      });
      await this.audit.record(
        {
          action: AuditAction.CHECKLIST_UPDATED,
          entityType: EntityType.WORK_ORDER,
          entityId: id,
          workOrderId: id,
          actorId: user.id,
          metadata: { label: 'Observaciones y conclusiones' },
        },
        tx,
      );
      return updated;
    });
  }
}
