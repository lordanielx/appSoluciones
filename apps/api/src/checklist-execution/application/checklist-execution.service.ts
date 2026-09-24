import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  VERSION_CONFLICT_MESSAGE,
  validateValueShape,
  type ChecklistResponseDto,
  type ChecklistValue,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { WorkOrderAccessService } from '../../work-orders/application/work-order-access.service';
import { ExecutionMapper } from '../../work-orders/application/execution.mapper';
import { userRef } from '../../work-orders/infrastructure/work-order.includes';

export interface ResponseUpdate {
  value: ChecklistValue;
  observation: string | null;
  baseVersion: number;
  force: boolean;
}

@Injectable()
export class ChecklistExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkOrderAccessService,
    private readonly mapper: ExecutionMapper,
    private readonly audit: AuditService,
  ) {}

  async get(workOrderId: string, user: AuthenticatedUser): Promise<ChecklistResponseDto[]> {
    await this.access.loadReadable(workOrderId, user);
    const rows = await this.prisma.checklistResponse.findMany({
      where: { execution: { workOrderId } },
      orderBy: { order: 'asc' },
      include: { answeredBy: userRef },
    });
    return rows.map((r) => this.mapper.response(r));
  }

  update(workOrderId: string, responseId: string, input: ResponseUpdate, user: AuthenticatedUser) {
    return this.prisma.$transaction((tx) => this.updateInTx(tx, workOrderId, responseId, input, user));
  }

  /**
   * Concurrencia optimista: si la versión del servidor avanzó desde que el técnico
   * leyó la respuesta, no se sobrescribe en silencio (409 con el valor actual).
   */
  async updateInTx(
    tx: Tx,
    workOrderId: string,
    responseId: string,
    input: ResponseUpdate,
    user: AuthenticatedUser,
  ): Promise<ChecklistResponseDto> {
    await this.access.loadExecutable(tx, workOrderId, user);
    const current = await tx.checklistResponse.findFirst({
      where: { id: responseId, execution: { workOrderId } },
      include: { answeredBy: userRef },
    });
    if (!current) throw AppException.notFound('La actividad del checklist');

    const shapeError = validateValueShape(current, input.value);
    if (shapeError) {
      throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, shapeError, { fields: { value: shapeError } });
    }
    const unchanged =
      JSON.stringify(current.value ?? null) === JSON.stringify(input.value) && (current.observation ?? null) === input.observation;
    if (unchanged) return this.mapper.response(current);

    if (current.version !== input.baseVersion && !input.force) {
      throw AppException.conflict(ErrorCode.VERSION_CONFLICT, VERSION_CONFLICT_MESSAGE, {
        server: this.mapper.response(current),
      });
    }

    const updated = await tx.checklistResponse.update({
      where: { id: responseId },
      data: {
        value: input.value === null ? Prisma.DbNull : (input.value as Prisma.InputJsonValue),
        observation: input.observation,
        version: { increment: 1 },
        answeredAt: new Date(),
        answeredById: user.id,
      },
      include: { answeredBy: userRef },
    });
    await this.audit.record(
      {
        action: AuditAction.CHECKLIST_UPDATED,
        entityType: EntityType.CHECKLIST_RESPONSE,
        entityId: responseId,
        workOrderId,
        actorId: user.id,
        metadata: { label: current.label, version: updated.version, forced: input.force && current.version !== input.baseVersion },
      },
      tx,
    );
    return this.mapper.response(updated);
  }
}
