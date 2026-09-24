import { Injectable } from '@nestjs/common';
import type { ChecklistResponse, Evidence, Signature } from '@prisma/client';
import type {
  ChecklistResponseDto,
  ChecklistValue,
  EvidenceDto,
  SignatureDto,
  UserRef,
} from '@meca/shared';
import { StorageService } from '../../storage/storage.service';
import { iso } from '../../common/util/dates';

@Injectable()
export class ExecutionMapper {
  constructor(private readonly storage: StorageService) {}

  response(r: ChecklistResponse & { answeredBy: UserRef | null }): ChecklistResponseDto {
    return {
      id: r.id,
      order: r.order,
      section: r.section,
      label: r.label,
      description: r.description,
      responseType: r.responseType,
      required: r.required,
      evidenceRequired: r.evidenceRequired,
      minPhotos: r.minPhotos,
      observationRequired: r.observationRequired,
      options: r.options,
      unit: r.unit,
      minValue: r.minValue,
      maxValue: r.maxValue,
      value: (r.value ?? null) as ChecklistValue,
      observation: r.observation,
      version: r.version,
      answeredAt: iso(r.answeredAt),
      answeredBy: r.answeredBy,
    };
  }

  async evidence(e: Evidence & { createdBy: UserRef }): Promise<EvidenceDto> {
    const [url, thumbnailUrl] = await Promise.all([
      this.storage.signedUrl(e.fileKey),
      this.storage.signedUrl(e.thumbnailKey),
    ]);
    return {
      id: e.id,
      workOrderId: e.workOrderId,
      checklistResponseId: e.checklistResponseId,
      caption: e.caption,
      mimeType: e.mimeType,
      width: e.width,
      height: e.height,
      sizeBytes: e.sizeBytes,
      capturedAt: iso(e.capturedAt),
      uploadedAt: e.uploadedAt.toISOString(),
      createdBy: e.createdBy,
      url,
      thumbnailUrl,
    };
  }

  async signature(s: Signature & { createdBy: UserRef }): Promise<SignatureDto> {
    const [pngUrl, svgUrl] = await Promise.all([this.storage.signedUrl(s.pngKey), this.storage.signedUrl(s.svgKey)]);
    return {
      id: s.id,
      workOrderId: s.workOrderId,
      signatureType: s.signatureType,
      signerName: s.signerName,
      signerRole: s.signerRole,
      signedAt: s.signedAt.toISOString(),
      consentAccepted: s.consentAccepted,
      createdBy: s.createdBy,
      pngUrl,
      svgUrl,
    };
  }
}
