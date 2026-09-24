import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  SyncOperationType,
  SyncResultStatus,
  TRANSITIONS,
  WorkOrderAction,
  rejectPayloadSchema,
  technicianNotesSchema,
  updateChecklistResponseSchema,
  type SyncOperationResult,
} from '@meca/shared';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { zodErrorDetails } from '../../common/zod/zod-error';
import { WorkOrderLifecycleCommands } from '../../work-orders/application/commands/work-order-lifecycle.commands';
import { WorkOrderQueries } from '../../work-orders/application/queries/work-order.queries';
import { ChecklistExecutionService } from '../../checklist-execution/application/checklist-execution.service';
import { EvidenceService } from '../../evidence/application/evidence.service';

export interface SyncOperation {
  clientOperationId: string;
  type: SyncOperationType;
  workOrderId: string;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const TRANSITION_OPS: Partial<Record<SyncOperationType, WorkOrderAction>> = {
  WORK_ORDER_ACCEPT: WorkOrderAction.ACCEPT,
  WORK_ORDER_REJECT: WorkOrderAction.REJECT,
  WORK_ORDER_START: WorkOrderAction.START,
  WORK_ORDER_SUBMIT: WorkOrderAction.SUBMIT,
};

/**
 * Aplica la cola offline del dispositivo en orden. Idempotencia por `clientOperationId`:
 * una operación ya aplicada devuelve DUPLICATE con el resultado original.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: WorkOrderLifecycleCommands,
    private readonly checklist: ChecklistExecutionService,
    private readonly evidence: EvidenceService,
    private readonly queries: WorkOrderQueries,
  ) {}

  async applyBatch(operations: SyncOperation[], user: AuthenticatedUser): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];
    for (const op of operations) {
      results.push(await this.applyOne(op, user));
    }
    return results;
  }

  pull(user: AuthenticatedUser) {
    return this.queries.technicianBundles(user).then((bundles) => ({ serverTime: new Date().toISOString(), bundles }));
  }

  private async applyOne(op: SyncOperation, user: AuthenticatedUser): Promise<SyncOperationResult> {
    const processed = await this.prisma.processedOperation.findUnique({ where: { clientOperationId: op.clientOperationId } });
    if (processed) {
      if (processed.userId !== user.id) {
        return { clientOperationId: op.clientOperationId, status: SyncResultStatus.REJECTED, errorCode: ErrorCode.FORBIDDEN, message: 'Operación no válida.' };
      }
      return { clientOperationId: op.clientOperationId, status: SyncResultStatus.DUPLICATE, data: processed.response };
    }
    try {
      const data = await this.execute(op, user);
      await this.remember(op, user, data);
      return { clientOperationId: op.clientOperationId, status: SyncResultStatus.APPLIED, data };
    } catch (error) {
      return this.toFailure(op, error, user);
    }
  }

  private async execute(op: SyncOperation, user: AuthenticatedUser): Promise<unknown> {
    switch (op.type) {
      case SyncOperationType.WORK_ORDER_ACCEPT:
        return statusOf(await this.lifecycle.accept(op.workOrderId, user));
      case SyncOperationType.WORK_ORDER_REJECT:
        return statusOf(await this.lifecycle.reject(op.workOrderId, rejectPayloadSchema.parse(op.payload).reason, user));
      case SyncOperationType.WORK_ORDER_START:
        return statusOf(await this.lifecycle.start(op.workOrderId, user));
      case SyncOperationType.WORK_ORDER_SUBMIT:
        return statusOf(await this.lifecycle.submit(op.workOrderId, user));
      case SyncOperationType.WORK_ORDER_NOTES: {
        const { technicianNotes } = technicianNotesSchema.parse(op.payload);
        const wo = await this.lifecycle.updateTechnicianNotes(op.workOrderId, technicianNotes, user);
        return { technicianNotes: wo.technicianNotes, version: wo.version };
      }
      case SyncOperationType.CHECKLIST_RESPONSE_UPDATE: {
        if (!op.entityId) throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Falta la actividad del checklist.');
        const input = updateChecklistResponseSchema.parse(op.payload);
        return this.checklist.update(op.workOrderId, op.entityId, input, user);
      }
      case SyncOperationType.EVIDENCE_DELETE:
        if (!op.entityId) throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Falta la evidencia.');
        await this.evidence.remove(op.workOrderId, op.entityId, user);
        return { deleted: op.entityId };
      default:
        throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Tipo de operación no soportado en lote.');
    }
  }

  private async remember(op: SyncOperation, user: AuthenticatedUser, data: unknown) {
    await this.prisma.processedOperation
      .create({
        data: {
          clientOperationId: op.clientOperationId,
          userId: user.id,
          type: op.type,
          statusCode: 200,
          response: (data ?? {}) as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => {
        // Otra solicitud concurrente registró la misma operación: el efecto ya quedó aplicado una vez.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      });
  }

  private async toFailure(op: SyncOperation, error: unknown, user: AuthenticatedUser): Promise<SyncOperationResult> {
    const base = { clientOperationId: op.clientOperationId };
    if (error instanceof z.ZodError) {
      return { ...base, status: SyncResultStatus.REJECTED, errorCode: ErrorCode.VALIDATION_ERROR, message: 'Datos inválidos.', data: zodErrorDetails(error) };
    }
    if (error instanceof AppException) {
      // Reintento de una transición que ya se aplicó (p. ej. respuesta perdida): se considera duplicada.
      const action = TRANSITION_OPS[op.type];
      if (action && error.code === ErrorCode.WORK_ORDER_INVALID_STATE) {
        const wo = await this.prisma.workOrder.findUnique({ where: { id: op.workOrderId }, select: { status: true } });
        if (wo && wo.status === TRANSITIONS[action].to) {
          await this.remember(op, user, { status: wo.status });
          return { ...base, status: SyncResultStatus.DUPLICATE, data: { status: wo.status } };
        }
      }
      const status = error.code === ErrorCode.VERSION_CONFLICT ? SyncResultStatus.CONFLICT : SyncResultStatus.REJECTED;
      return { ...base, status, errorCode: error.code, message: error.message, data: error.details };
    }
    this.logger.error({ err: error, op: op.type }, 'Error aplicando operación de sincronización');
    throw error;
  }
}

const statusOf = (wo: { status: string; version: number }) => ({ status: wo.status, version: wo.version });
