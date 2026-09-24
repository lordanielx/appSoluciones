import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { SignatureType, type ChecklistValue } from '@meca/shared';
import type { Tx } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import type { ReportData, ReportSignature } from '../domain/report-data';

/** Resolución de las fotos embebidas en el PDF (equilibrio calidad/tamaño). */
const PDF_PHOTO_MAX = 1280;

export interface ReportDataMeta {
  reportNumber: string;
  version: number;
  preview: boolean;
  generatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
}

@Injectable()
export class ReportDataLoader {
  constructor(private readonly storage: StorageService) {}

  async load(tx: Tx, workOrderId: string, meta: ReportDataMeta): Promise<ReportData> {
    const wo = await tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      include: {
        client: true,
        equipment: true,
        serviceType: true,
        representedCompany: true,
        assignedTechnician: { select: { fullName: true } },
        clientSignatureWaivedBy: { select: { fullName: true } },
        checklistExecution: { include: { responses: { orderBy: { order: 'asc' } } } },
        evidence: { where: { deletedAt: null }, orderBy: [{ capturedAt: 'asc' }, { uploadedAt: 'asc' }] },
        signatures: { where: { supersededAt: null } },
      },
    });

    const responses = wo.checklistExecution?.responses ?? [];
    const order = new Map(responses.map((r, i) => [r.id, i]));
    // Fotos agrupadas en el orden del checklist; las generales al final.
    const evidence = [...wo.evidence].sort((a, b) => {
      const oa = a.checklistResponseId ? (order.get(a.checklistResponseId) ?? 9999) : 10_000;
      const ob = b.checklistResponseId ? (order.get(b.checklistResponseId) ?? 9999) : 10_000;
      return oa - ob;
    });
    const labelById = new Map(responses.map((r) => [r.id, r.label]));
    const photos = await Promise.all(
      evidence.map(async (e, index) => ({
        number: index + 1,
        responseId: e.checklistResponseId,
        dataUri: await this.photoDataUri(e.fileKey),
        caption: e.caption,
        activity: e.checklistResponseId ? (labelById.get(e.checklistResponseId) ?? null) : null,
        capturedAt: e.capturedAt,
      })),
    );

    const brand = wo.representedCompany;
    const signature = async (type: SignatureType): Promise<ReportSignature | null> => {
      const s = wo.signatures.find((x) => x.signatureType === type);
      if (!s) return null;
      return { signerName: s.signerName, signerRole: s.signerRole, signedAt: s.signedAt, pngDataUri: await this.storage.dataUri(s.pngKey) };
    };

    return {
      ...meta,
      brand: {
        name: brand.name,
        legalName: brand.legalName,
        nit: brand.nit,
        address: brand.address,
        phone: brand.phone,
        email: brand.email,
        website: brand.website,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        footerText: brand.footerText,
        logoDataUri: brand.logoKey ? await this.storage.dataUri(brand.logoKey).catch(() => null) : null,
      },
      workOrder: {
        number: wo.number,
        title: wo.title,
        serviceType: wo.serviceType.name,
        priority: wo.priority,
        description: wo.description,
        serviceScope: wo.serviceScope,
        address: wo.address,
        contactName: wo.contactName,
        contactPhone: wo.contactPhone,
        scheduledStart: wo.scheduledStart,
        startedAt: wo.startedAt,
        submittedAt: wo.submittedAt,
        technicianNotes: wo.technicianNotes,
        technician: wo.assignedTechnician?.fullName ?? null,
        clientSignatureWaived: wo.clientSignatureWaived,
        clientSignatureWaiverReason: wo.clientSignatureWaiverReason,
        clientSignatureWaivedBy: wo.clientSignatureWaivedBy?.fullName ?? null,
      },
      client: {
        legalName: wo.client.legalName,
        tradeName: wo.client.tradeName,
        nit: wo.client.nit,
        dv: wo.client.dv,
        address: wo.client.address,
        city: wo.client.city,
        department: wo.client.department,
      },
      equipment: wo.equipment
        ? {
            code: wo.equipment.code,
            name: wo.equipment.name,
            category: wo.equipment.category,
            brand: wo.equipment.brand,
            model: wo.equipment.model,
            serial: wo.equipment.serial,
            location: wo.equipment.location,
            description: wo.equipment.description,
          }
        : null,
      checklist: responses.map((r) => ({
        order: r.order,
        section: r.section,
        label: r.label,
        responseType: r.responseType,
        value: (r.value ?? null) as ChecklistValue,
        unit: r.unit,
        minValue: r.minValue,
        maxValue: r.maxValue,
        observation: r.observation,
        photoNumbers: photos.filter((p) => p.responseId === r.id).map((p) => p.number),
      })),
      photos: photos.map(({ responseId: _r, ...p }) => p),
      technicianSignature: await signature(SignatureType.TECHNICIAN),
      clientSignature: await signature(SignatureType.CLIENT),
    };
  }

  private async photoDataUri(key: string): Promise<string> {
    const obj = await this.storage.get(key);
    const resized = await sharp(obj.body)
      .resize({ width: PDF_PHOTO_MAX, height: PDF_PHOTO_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  }
}
