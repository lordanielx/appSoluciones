import { Injectable } from '@nestjs/common';
import type { ServiceType } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  type ServiceTypeDto,
  type ServiceTypeInput,
  type UpdateServiceTypeInput,
} from '@meca/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { AppException } from '../../common/errors/app.exception';

@Injectable()
export class ServiceTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(activeOnly: boolean): Promise<ServiceTypeDto[]> {
    const rows = await this.prisma.serviceType.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { name: 'asc' },
    });
    return rows.map(toServiceTypeDto);
  }

  async create(input: ServiceTypeInput, actorId: string): Promise<ServiceTypeDto> {
    if (await this.prisma.serviceType.findUnique({ where: { code: input.code } })) {
      throw AppException.conflict(ErrorCode.DUPLICATE, `Ya existe un tipo de servicio con código ${input.code}.`);
    }
    const row = await this.prisma.serviceType.create({ data: input });
    await this.audit.record({
      action: AuditAction.SERVICE_TYPE_CREATED,
      entityType: EntityType.SERVICE_TYPE,
      entityId: row.id,
      actorId,
      metadata: { code: row.code },
    });
    return toServiceTypeDto(row);
  }

  async update(id: string, input: UpdateServiceTypeInput, actorId: string): Promise<ServiceTypeDto> {
    const current = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!current) throw AppException.notFound('El tipo de servicio');
    const row = await this.prisma.serviceType.update({ where: { id }, data: input });
    await this.audit.record({
      action: AuditAction.SERVICE_TYPE_UPDATED,
      entityType: EntityType.SERVICE_TYPE,
      entityId: id,
      actorId,
      metadata: { fields: Object.keys(input) },
    });
    return toServiceTypeDto(row);
  }
}

export const toServiceTypeDto = (s: ServiceType): ServiceTypeDto => ({
  id: s.id,
  code: s.code,
  name: s.name,
  description: s.description,
  requiresEquipment: s.requiresEquipment,
  active: s.active,
});
