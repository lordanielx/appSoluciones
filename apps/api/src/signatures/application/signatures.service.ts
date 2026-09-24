import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  CLIENT_SIGNATURE_CONSENT_TEXT,
  EntityType,
  ErrorCode,
  SignatureType,
  type SignatureDto,
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
import { parseStrokes, strokesToSvg } from '../domain/strokes';

export interface SignatureMeta {
  id: string;
  signatureType: SignatureType;
  signerName: string;
  signerRole: string | null;
  signedAt: Date;
  consentAccepted: boolean;
}

@Injectable()
export class SignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkOrderAccessService,
    private readonly images: ImageService,
    private readonly storage: StorageService,
    private readonly mapper: ExecutionMapper,
    private readonly audit: AuditService,
  ) {}

  async list(workOrderId: string, user: AuthenticatedUser): Promise<SignatureDto[]> {
    await this.access.loadReadable(workOrderId, user);
    const rows = await this.prisma.signature.findMany({
      where: { workOrderId, supersededAt: null },
      include: { createdBy: userRef },
      orderBy: { signedAt: 'asc' },
    });
    return Promise.all(rows.map((r) => this.mapper.signature(r)));
  }

  /** Idempotente por `id`. Una nueva firma del mismo tipo reemplaza la anterior sin borrarla. */
  async add(
    workOrderId: string,
    meta: SignatureMeta,
    png: Buffer,
    rawStrokes: unknown,
    user: AuthenticatedUser,
  ): Promise<SignatureDto> {
    const existing = await this.findExisting(meta.id, workOrderId);
    if (existing) return existing;

    const wo = await this.access.loadReadable(workOrderId, user);
    WorkOrderPolicy.assertCanExecute(user, wo);

    let svg: string;
    try {
      svg = strokesToSvg(parseStrokes(rawStrokes));
    } catch {
      throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'La firma está vacía o no es válida. Solicite firmar nuevamente.');
    }
    const normalizedPng = await this.images.processSignaturePng(png);
    const pngKey = this.storage.buildKey(StorageArea.SIGNATURES, workOrderId, 'png');
    const svgKey = pngKey.replace(/\.png$/, '.svg');
    await Promise.all([
      this.storage.put(pngKey, normalizedPng, 'image/png'),
      this.storage.put(svgKey, Buffer.from(svg, 'utf8'), 'image/svg+xml'),
    ]);

    return this.prisma.$transaction(async (tx: Tx) => {
      await this.access.loadExecutable(tx, workOrderId, user);
      const again = await this.findExisting(meta.id, workOrderId, tx);
      if (again) return again;
      await tx.signature.updateMany({
        where: { workOrderId, signatureType: meta.signatureType, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      const row = await tx.signature.create({
        data: {
          id: meta.id,
          workOrderId,
          signatureType: meta.signatureType,
          signerName: meta.signerName,
          signerRole: meta.signerRole,
          signedAt: meta.signedAt,
          consentAccepted: meta.consentAccepted,
          consentText: meta.signatureType === SignatureType.CLIENT ? CLIENT_SIGNATURE_CONSENT_TEXT : null,
          pngKey,
          svgKey,
          createdById: user.id,
        },
        include: { createdBy: userRef },
      });
      await this.audit.record(
        {
          action: AuditAction.SIGNATURE_ADDED,
          entityType: EntityType.SIGNATURE,
          entityId: row.id,
          workOrderId,
          actorId: user.id,
          metadata: { signatureType: row.signatureType, signerName: row.signerName, signedAt: row.signedAt.toISOString() },
        },
        tx,
      );
      return this.mapper.signature(row);
    });
  }

  private async findExisting(id: string, workOrderId: string, tx?: Tx) {
    const row = await (tx ?? this.prisma).signature.findUnique({ where: { id }, include: { createdBy: userRef } });
    if (!row) return null;
    if (row.workOrderId !== workOrderId) {
      throw AppException.conflict(ErrorCode.CONFLICT, 'El identificador de la firma ya está en uso.');
    }
    return this.mapper.signature(row);
  }
}
