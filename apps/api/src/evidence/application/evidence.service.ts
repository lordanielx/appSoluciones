import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  MAX_PHOTOS_PER_ITEM,
  type EvidenceDto,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { ImageService } from '../../media/image.service';
import { StorageArea, StorageService } from '../../storage/storage.service';
import { WorkOrderAccessService } from '../../work-orders/application/work-order-access.service';
import { ExecutionMapper } from '../../work-orders/application/execution.mapper';
import { WorkOrderPolicy } from '../../work-orders/domain/work-order.policy';
import { userRef } from '../../work-orders/infrastructure/work-order.includes';

const MAX_PHOTOS_PER_WORK_ORDER = 150;
/** Holgura sobre el mínimo exigido por ítem (fotos adicionales de contexto). */
const PHOTOS_PER_ITEM_LIMIT = MAX_PHOTOS_PER_ITEM * 2;

export interface EvidenceMeta {
  id: string;
  checklistResponseId: string | null;
  caption: string | null;
  capturedAt: Date | null;
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkOrderAccessService,
    private readonly images: ImageService,
    private readonly storage: StorageService,
    private readonly mapper: ExecutionMapper,
    private readonly audit: AuditService,
  ) {}

  async list(workOrderId: string, user: AuthenticatedUser): Promise<EvidenceDto[]> {
    await this.access.loadReadable(workOrderId, user);
    const rows = await this.prisma.evidence.findMany({
      where: { workOrderId, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
      include: { createdBy: userRef },
    });
    return Promise.all(rows.map((r) => this.mapper.evidence(r)));
  }

  /**
   * Idempotente por `id` (UUID generado en el dispositivo): reintentos de la cola offline
   * devuelven la evidencia ya registrada sin duplicar archivos ni filas.
   */
  async add(workOrderId: string, meta: EvidenceMeta, file: Buffer, user: AuthenticatedUser): Promise<EvidenceDto> {
    const existing = await this.findExisting(meta.id, workOrderId);
    if (existing) return existing;

    // Verificación rápida antes de procesar la imagen; la definitiva ocurre con bloqueo.
    const wo = await this.access.loadReadable(workOrderId, user);
    WorkOrderPolicy.assertCanExecute(user, wo);

    const processed = await this.images.processPhoto(file);
    const fileKey = this.storage.buildKey(StorageArea.EVIDENCE, workOrderId, 'jpg');
    const thumbnailKey = fileKey.replace(/\.jpg$/, '-thumb.jpg');
    await Promise.all([
      this.storage.put(fileKey, processed.full, processed.mimeType),
      this.storage.put(thumbnailKey, processed.thumbnail, processed.mimeType),
    ]);

    return this.prisma.$transaction(async (tx) => {
      await this.access.loadExecutable(tx, workOrderId, user);
      const again = await this.findExisting(meta.id, workOrderId, tx);
      if (again) return again;
      await this.assertLimits(tx, workOrderId, meta.checklistResponseId);
      const row = await tx.evidence.create({
        data: {
          id: meta.id,
          workOrderId,
          checklistResponseId: meta.checklistResponseId,
          fileKey,
          thumbnailKey,
          mimeType: processed.mimeType,
          sizeBytes: processed.full.length,
          width: processed.width,
          height: processed.height,
          caption: meta.caption,
          capturedAt: meta.capturedAt,
          createdById: user.id,
        },
        include: { createdBy: userRef },
      });
      await this.audit.record(
        {
          action: AuditAction.EVIDENCE_ADDED,
          entityType: EntityType.EVIDENCE,
          entityId: row.id,
          workOrderId,
          actorId: user.id,
          metadata: { checklistResponseId: meta.checklistResponseId, sizeBytes: row.sizeBytes },
        },
        tx,
      );
      return this.mapper.evidence(row);
    });
  }

  /** Retiro lógico (RB-016): la fila y el archivo se conservan para trazabilidad. */
  remove(workOrderId: string, evidenceId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction((tx) => this.removeInTx(tx, workOrderId, evidenceId, user));
  }

  async removeInTx(tx: Tx, workOrderId: string, evidenceId: string, user: AuthenticatedUser): Promise<void> {
    await this.access.loadExecutable(tx, workOrderId, user);
    const ev = await tx.evidence.findFirst({ where: { id: evidenceId, workOrderId } });
    if (!ev) throw AppException.notFound('La evidencia');
    if (ev.deletedAt) return;
    await tx.evidence.update({ where: { id: evidenceId }, data: { deletedAt: new Date(), deletedById: user.id } });
    await this.audit.record(
      {
        action: AuditAction.EVIDENCE_REMOVED,
        entityType: EntityType.EVIDENCE,
        entityId: evidenceId,
        workOrderId,
        actorId: user.id,
      },
      tx,
    );
  }

  private async findExisting(id: string, workOrderId: string, tx?: Tx): Promise<EvidenceDto | null> {
    const row = await (tx ?? this.prisma).evidence.findUnique({ where: { id }, include: { createdBy: userRef } });
    if (!row) return null;
    if (row.workOrderId !== workOrderId) {
      throw AppException.conflict(ErrorCode.CONFLICT, 'El identificador de la evidencia ya está en uso.');
    }
    return this.mapper.evidence(row);
  }

  private async assertLimits(tx: Tx, workOrderId: string, responseId: string | null) {
    if (responseId) {
      const response = await tx.checklistResponse.findFirst({ where: { id: responseId, execution: { workOrderId } } });
      if (!response) {
        throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'La actividad indicada no pertenece a esta orden.');
      }
      const count = await tx.evidence.count({ where: { checklistResponseId: responseId, deletedAt: null } });
      if (count >= PHOTOS_PER_ITEM_LIMIT) {
        throw AppException.unprocessable(ErrorCode.VALIDATION_ERROR, `Máximo ${PHOTOS_PER_ITEM_LIMIT} fotografías por actividad.`);
      }
    }
    const total = await tx.evidence.count({ where: { workOrderId, deletedAt: null } });
    if (total >= MAX_PHOTOS_PER_WORK_ORDER) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_ERROR, `Máximo ${MAX_PHOTOS_PER_WORK_ORDER} fotografías por orden.`);
    }
  }
}
