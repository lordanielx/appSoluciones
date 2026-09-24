import { Injectable } from '@nestjs/common';
import { evaluateSubmission, type ChecklistValue, type SubmissionSummary } from '@meca/shared';
import type { WorkOrder } from '@prisma/client';
import type { Tx } from '../../prisma/prisma.service';

/** Reúne el estado real persistido y aplica las reglas compartidas RB-006..RB-010. */
@Injectable()
export class SubmissionEvaluator {
  async evaluate(tx: Tx, wo: WorkOrder): Promise<SubmissionSummary> {
    const [responses, signatures] = await Promise.all([
      tx.checklistResponse.findMany({
        where: { execution: { workOrderId: wo.id } },
        orderBy: { order: 'asc' },
        include: { _count: { select: { evidence: { where: { deletedAt: null } } } } },
      }),
      tx.signature.findMany({ where: { workOrderId: wo.id, supersededAt: null }, select: { signatureType: true } }),
    ]);
    return evaluateSubmission({
      items: responses.map((r) => ({
        id: r.id,
        label: r.label,
        section: r.section,
        responseType: r.responseType,
        required: r.required,
        evidenceRequired: r.evidenceRequired,
        minPhotos: r.minPhotos,
        observationRequired: r.observationRequired,
        options: r.options,
        minValue: r.minValue,
        maxValue: r.maxValue,
        value: (r.value ?? null) as ChecklistValue,
        observation: r.observation,
        photoCount: r._count.evidence,
      })),
      technicianNotes: wo.technicianNotes,
      signatureTypes: signatures.map((s) => s.signatureType),
      clientSignatureWaived: wo.clientSignatureWaived,
    });
  }
}
