import { Injectable } from '@nestjs/common';
import type { ChecklistTemplate, ChecklistTemplateItem, Prisma, ServiceType } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  type ChecklistItemTemplateData,
  type ChecklistItemTemplateDto,
  type ChecklistTemplateData,
  type ChecklistTemplateDto,
  type ChecklistTemplateListQuery,
  type Paginated,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { AppException } from '../../common/errors/app.exception';
import { paginated, skipTake } from '../../common/util/pagination';

type TemplateRow = ChecklistTemplate & {
  serviceType: Pick<ServiceType, 'id' | 'name' | 'code'> | null;
  _count?: { items: number };
  items?: ChecklistTemplateItem[];
};

export interface UpdateTemplateData {
  name?: string;
  serviceTypeId?: string | null;
  description?: string | null;
  active?: boolean;
  items?: ChecklistItemTemplateData[];
}

const activeItems = { where: { archivedAt: null } } as const;

/**
 * Plantillas configurables. Cambiar las actividades incrementa `version`; las OT ya creadas
 * conservan su copia del checklist (ASSUMPTIONS A-05).
 */
@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ChecklistTemplateListQuery): Promise<Paginated<ChecklistTemplateDto>> {
    const where: Prisma.ChecklistTemplateWhereInput = {
      active: q.active,
      serviceTypeId: q.serviceTypeId,
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.checklistTemplate.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { serviceType: { select: { id: true, name: true, code: true } }, _count: { select: { items: activeItems } } },
        ...skipTake(q),
      }),
      this.prisma.checklistTemplate.count({ where }),
    ]);
    return paginated(rows.map((r) => toTemplateDto(r)), total, q);
  }

  async get(id: string): Promise<ChecklistTemplateDto> {
    const row = await this.prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        serviceType: { select: { id: true, name: true, code: true } },
        items: { ...activeItems, orderBy: { order: 'asc' } },
      },
    });
    if (!row) throw AppException.notFound('La plantilla de checklist');
    return toTemplateDto(row);
  }

  async create(input: ChecklistTemplateData, actorId: string): Promise<ChecklistTemplateDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: { name: input.name, serviceTypeId: input.serviceTypeId, description: input.description },
      });
      await tx.checklistTemplateItem.createMany({
        data: input.items.map((item, index) => itemData(template.id, item, index)),
      });
      await this.audit.record(
        {
          action: AuditAction.CHECKLIST_TEMPLATE_CREATED,
          entityType: EntityType.CHECKLIST_TEMPLATE,
          entityId: template.id,
          actorId,
          metadata: { name: template.name, items: input.items.length },
        },
        tx,
      );
      return template.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateTemplateData, actorId: string): Promise<ChecklistTemplateDto> {
    await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      const { items, ...fields } = input;
      if (items) await this.replaceItems(tx, id, items);
      await tx.checklistTemplate.update({
        where: { id },
        data: { ...fields, ...(items ? { version: { increment: 1 } } : {}) },
      });
      await this.audit.record(
        {
          action: AuditAction.CHECKLIST_TEMPLATE_UPDATED,
          entityType: EntityType.CHECKLIST_TEMPLATE,
          entityId: id,
          actorId,
          metadata: { fields: Object.keys(input), items: items?.length },
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Actualiza ítems existentes por id, crea los nuevos y archiva los retirados (sin borrar). */
  private async replaceItems(tx: Tx, templateId: string, items: ChecklistItemTemplateData[]) {
    const existing = await tx.checklistTemplateItem.findMany({ where: { checklistTemplateId: templateId, archivedAt: null } });
    const existingIds = new Set(existing.map((e) => e.id));
    const keep = new Set<string>();
    for (const [index, item] of items.entries()) {
      const data = itemData(templateId, item, index);
      if (item.id && existingIds.has(item.id)) {
        keep.add(item.id);
        const { id: _id, ...update } = data;
        await tx.checklistTemplateItem.update({ where: { id: item.id }, data: update });
      } else {
        const { id: _id, ...create } = data;
        await tx.checklistTemplateItem.create({ data: create });
      }
    }
    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (removed.length) {
      await tx.checklistTemplateItem.updateMany({ where: { id: { in: removed } }, data: { archivedAt: new Date() } });
    }
  }
}

function itemData(templateId: string, item: ChecklistItemTemplateData, index: number) {
  return {
    id: item.id,
    checklistTemplateId: templateId,
    order: index + 1,
    section: item.section,
    label: item.label,
    description: item.description,
    responseType: item.responseType,
    required: item.required,
    evidenceRequired: item.evidenceRequired,
    minPhotos: item.minPhotos,
    observationRequired: item.observationRequired,
    options: item.options,
    unit: item.unit,
    minValue: item.minValue,
    maxValue: item.maxValue,
  };
}

export function toItemDto(i: ChecklistTemplateItem): ChecklistItemTemplateDto {
  return {
    id: i.id,
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
  };
}

function toTemplateDto(t: TemplateRow): ChecklistTemplateDto {
  return {
    id: t.id,
    name: t.name,
    serviceTypeId: t.serviceTypeId,
    serviceType: t.serviceType,
    description: t.description,
    version: t.version,
    active: t.active,
    itemCount: t.items?.length ?? t._count?.items ?? 0,
    items: t.items?.map(toItemDto),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
