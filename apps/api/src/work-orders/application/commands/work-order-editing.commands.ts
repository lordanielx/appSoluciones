import { Injectable } from '@nestjs/common';
import type { Prisma, WorkOrder } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  NumberPrefix,
  Role,
  VERSION_CONFLICT_MESSAGE,
  WorkOrderAction,
  WorkOrderStatus,
  type CreateWorkOrderData,
  type UpdateWorkOrderData,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../../common/auth/auth-user';
import { AppException } from '../../../common/errors/app.exception';
import { CounterRepository } from '../../infrastructure/counter.repository';
import { WorkOrderAccessService } from '../work-order-access.service';
import { WorkOrderTransitionsService } from '../work-order-transitions.service';

/** Estados en los que aún puede cambiarse cliente, equipo, servicio o plantilla. */
const STRUCTURAL_EDIT_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.DRAFT,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.REJECTED,
];
const LOCKED_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.APPROVED,
  WorkOrderStatus.CLOSED,
  WorkOrderStatus.CANCELLED,
];
const STRUCTURAL_FIELDS = ['clientId', 'equipmentId', 'serviceTypeId', 'checklistTemplateId'] as const;

@Injectable()
export class WorkOrderEditingCommands {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CounterRepository,
    private readonly access: WorkOrderAccessService,
    private readonly transitions: WorkOrderTransitionsService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateWorkOrderData, user: AuthenticatedUser): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const refs = await this.validateReferences(tx, input);
      if (input.assignedTechnicianId) await this.assertTechnician(tx, input.assignedTechnicianId);
      const number = await this.counters.next(tx, NumberPrefix.WORK_ORDER);
      const { assignNow, ...data } = input;
      const wo = await tx.workOrder.create({
        data: {
          ...data,
          number,
          status: WorkOrderStatus.DRAFT,
          address: data.address ?? formatClientAddress(refs.client),
          contactName: data.contactName ?? refs.client.contactName,
          contactPhone: data.contactPhone ?? refs.client.phone,
          createdById: user.id,
        },
      });
      await this.snapshotChecklist(tx, wo.id, input.checklistTemplateId);
      await tx.workOrderStatusHistory.create({
        data: { workOrderId: wo.id, fromStatus: null, toStatus: WorkOrderStatus.DRAFT, actorId: user.id },
      });
      await this.audit.record(
        {
          action: AuditAction.WORK_ORDER_CREATED,
          entityType: EntityType.WORK_ORDER,
          entityId: wo.id,
          workOrderId: wo.id,
          actorId: user.id,
          metadata: { number, clientId: wo.clientId, title: wo.title },
        },
        tx,
      );
      if (assignNow && wo.assignedTechnicianId) {
        await this.assignInTx(tx, wo, wo.assignedTechnicianId, user);
      }
      return wo.id;
    });
  }

  async update(id: string, input: UpdateWorkOrderData, user: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      if (wo.version !== input.version) {
        throw AppException.conflict(ErrorCode.VERSION_CONFLICT, VERSION_CONFLICT_MESSAGE, { currentVersion: wo.version });
      }
      if (LOCKED_STATUSES.includes(wo.status)) {
        throw AppException.conflict(
          ErrorCode.WORK_ORDER_NOT_EDITABLE,
          'La orden está aprobada, cerrada o anulada y no puede modificarse. Para corregir un informe aprobado, reábrala solicitando corrección.',
        );
      }
      const { version: _v, ...changes } = input;
      const structuralChanged = STRUCTURAL_FIELDS.filter(
        (f) => changes[f] !== undefined && changes[f] !== wo[f],
      );
      if (structuralChanged.length && !STRUCTURAL_EDIT_STATUSES.includes(wo.status)) {
        throw AppException.conflict(
          ErrorCode.WORK_ORDER_NOT_EDITABLE,
          'Cliente, equipo, tipo de servicio y plantilla solo pueden cambiarse antes de que el técnico acepte la orden.',
          { fields: structuralChanged },
        );
      }
      const merged = {
        clientId: changes.clientId ?? wo.clientId,
        equipmentId: changes.equipmentId !== undefined ? changes.equipmentId : wo.equipmentId,
        serviceTypeId: changes.serviceTypeId ?? wo.serviceTypeId,
        representedCompanyId: changes.representedCompanyId ?? wo.representedCompanyId,
        checklistTemplateId: changes.checklistTemplateId ?? wo.checklistTemplateId,
      };
      await this.validateReferences(tx, merged);
      const scheduledStart = changes.scheduledStart !== undefined ? changes.scheduledStart : wo.scheduledStart;
      const scheduledEnd = changes.scheduledEnd !== undefined ? changes.scheduledEnd : wo.scheduledEnd;
      if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) {
        throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'La hora final debe ser posterior al inicio.', {
          fields: { scheduledEnd: 'La hora final debe ser posterior al inicio.' },
        });
      }
      await tx.workOrder.update({
        where: { id },
        data: { ...(changes as Prisma.WorkOrderUncheckedUpdateInput), version: { increment: 1 } },
      });
      if (structuralChanged.includes('checklistTemplateId')) {
        await this.replaceChecklistSnapshot(tx, id, merged.checklistTemplateId);
      }
      await this.audit.record(
        {
          action: AuditAction.WORK_ORDER_UPDATED,
          entityType: EntityType.WORK_ORDER,
          entityId: id,
          workOrderId: id,
          actorId: user.id,
          metadata: { fields: Object.keys(changes) },
        },
        tx,
      );
    });
  }

  async assign(id: string, technicianId: string, user: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wo = await this.access.lockForUpdate(tx, id, user);
      await this.assignInTx(tx, wo, technicianId, user);
    });
  }

  private async assignInTx(tx: Tx, wo: WorkOrder, technicianId: string, user: AuthenticatedUser) {
    const technician = await this.assertTechnician(tx, technicianId);
    await this.transitions.apply(tx, WorkOrderAction.ASSIGN, wo, user, {
      data: { assignedTechnicianId: technicianId, assignedAt: new Date(), acceptedAt: null, rejectionReason: null },
      comment: `Asignada a ${technician.fullName}`,
      audit: {
        action: AuditAction.WORK_ORDER_ASSIGNED,
        metadata: { technicianId, technicianName: technician.fullName, previousTechnicianId: wo.assignedTechnicianId },
      },
    });
  }

  private async assertTechnician(tx: Tx, technicianId: string) {
    const tech = await tx.user.findUnique({ where: { id: technicianId } });
    if (!tech || tech.role !== Role.TECHNICIAN || !tech.active) {
      throw AppException.unprocessable(
        ErrorCode.WORK_ORDER_REQUIRES_TECHNICIAN,
        'Seleccione un técnico activo para asignar la orden.',
        { fields: { assignedTechnicianId: 'Técnico inválido o inactivo.' } },
      );
    }
    return tech;
  }

  /** RB-001, RB-002, RB-012: referencias válidas y activas. */
  private async validateReferences(
    tx: Tx,
    input: Pick<CreateWorkOrderData, 'clientId' | 'equipmentId' | 'serviceTypeId' | 'representedCompanyId' | 'checklistTemplateId'>,
  ) {
    const [client, serviceType, brand, template, equipment] = await Promise.all([
      tx.client.findUnique({ where: { id: input.clientId } }),
      tx.serviceType.findUnique({ where: { id: input.serviceTypeId } }),
      tx.brandProfile.findUnique({ where: { id: input.representedCompanyId } }),
      tx.checklistTemplate.findUnique({ where: { id: input.checklistTemplateId } }),
      input.equipmentId ? tx.equipment.findUnique({ where: { id: input.equipmentId } }) : Promise.resolve(null),
    ]);
    const fields: Record<string, string> = {};
    if (!client || !client.active) fields.clientId = 'Seleccione un cliente activo.';
    if (!serviceType || !serviceType.active) fields.serviceTypeId = 'Seleccione un tipo de servicio activo.';
    if (!brand || !brand.active) fields.representedCompanyId = 'Seleccione una empresa representada activa.';
    if (!template || !template.active) fields.checklistTemplateId = 'Seleccione una plantilla de checklist activa.';
    if (input.equipmentId) {
      if (!equipment || !equipment.active) fields.equipmentId = 'Seleccione un equipo activo.';
      else if (equipment.clientId !== input.clientId) fields.equipmentId = 'El equipo no pertenece al cliente seleccionado.';
    } else if (serviceType?.requiresEquipment) {
      fields.equipmentId = 'Este tipo de servicio requiere seleccionar un equipo.';
    }
    if (Object.keys(fields).length) {
      const code = fields.equipmentId && Object.keys(fields).length === 1 && !input.equipmentId
        ? ErrorCode.WORK_ORDER_REQUIRES_EQUIPMENT
        : ErrorCode.VALIDATION_ERROR;
      throw AppException.unprocessable(code, Object.values(fields)[0] as string, { fields });
    }
    return { client: client!, serviceType: serviceType!, brand: brand!, template: template! };
  }

  /** Copia las actividades de la plantilla a la OT (A-05). */
  private async snapshotChecklist(tx: Tx, workOrderId: string, templateId: string) {
    const template = await tx.checklistTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { items: { where: { archivedAt: null }, orderBy: { order: 'asc' } } },
    });
    const execution = await tx.checklistExecution.create({
      data: { workOrderId, templateId, templateVersion: template.version },
    });
    await tx.checklistResponse.createMany({
      data: template.items.map((i) => ({
        executionId: execution.id,
        templateItemId: i.id,
        order: i.order,
        section: i.section,
        label: i.label,
        description: i.description,
        responseType: i.responseType,
        required: i.required,
        evidenceRequired: i.evidenceRequired,
        minPhotos: i.minPhotos,
        observationRequired: i.observationRequired,
        options: i.options,
        unit: i.unit,
        minValue: i.minValue,
        maxValue: i.maxValue,
      })),
    });
  }

  /** Solo antes de la aceptación; aún no hay respuestas ni evidencias. */
  private async replaceChecklistSnapshot(tx: Tx, workOrderId: string, templateId: string) {
    const execution = await tx.checklistExecution.findUnique({ where: { workOrderId } });
    if (execution) {
      const hasEvidence = await tx.evidence.count({ where: { workOrderId } });
      if (hasEvidence) {
        throw AppException.conflict(ErrorCode.WORK_ORDER_NOT_EDITABLE, 'La orden ya tiene evidencias; no se puede cambiar la plantilla.');
      }
      await tx.checklistResponse.deleteMany({ where: { executionId: execution.id } });
      await tx.checklistExecution.delete({ where: { id: execution.id } });
    }
    await this.snapshotChecklist(tx, workOrderId, templateId);
  }
}

function formatClientAddress(c: { address: string | null; city: string | null; department: string | null }) {
  const parts = [c.address, c.city, c.department].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
