import { Injectable } from '@nestjs/common';
import type { Client, Equipment, Prisma } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  type EquipmentDto,
  type EquipmentInput,
  type EquipmentListQuery,
  type Paginated,
  type UpdateEquipmentInput,
} from '@meca/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { AppException } from '../../common/errors/app.exception';
import { paginated, skipTake } from '../../common/util/pagination';
import { StorageArea, StorageService } from '../../storage/storage.service';
import { ImageService } from '../../media/image.service';

type EquipmentWithClient = Equipment & { client: Pick<Client, 'id' | 'legalName' | 'tradeName' | 'nit' | 'dv'> };

const clientRef = { select: { id: true, legalName: true, tradeName: true, nit: true, dv: true } } as const;

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  async list(q: EquipmentListQuery): Promise<Paginated<EquipmentDto>> {
    const where: Prisma.EquipmentWhereInput = {
      clientId: q.clientId,
      active: q.active,
      ...(q.q
        ? {
            OR: [
              { code: { contains: q.q, mode: 'insensitive' } },
              { name: { contains: q.q, mode: 'insensitive' } },
              { serial: { contains: q.q, mode: 'insensitive' } },
              { brand: { contains: q.q, mode: 'insensitive' } },
              { model: { contains: q.q, mode: 'insensitive' } },
              { client: { legalName: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        orderBy: [{ client: { legalName: 'asc' } }, { code: 'asc' }],
        include: { client: clientRef },
        ...skipTake(q),
      }),
      this.prisma.equipment.count({ where }),
    ]);
    return paginated(await Promise.all(rows.map((r) => this.toDto(r))), total, q);
  }

  async get(id: string): Promise<EquipmentDto> {
    const row = await this.prisma.equipment.findUnique({ where: { id }, include: { client: clientRef } });
    if (!row) throw AppException.notFound('El equipo');
    return this.toDto(row);
  }

  async create(input: EquipmentInput, actorId: string): Promise<EquipmentDto> {
    const client = await this.prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw AppException.notFound('El cliente');
    if (!client.active) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_ERROR, 'No se pueden registrar equipos en un cliente inactivo.');
    }
    await this.assertCodeAvailable(input.clientId, input.code);
    const row = await this.prisma.equipment.create({ data: input, include: { client: clientRef } });
    await this.audit.record({
      action: AuditAction.EQUIPMENT_CREATED,
      entityType: EntityType.EQUIPMENT,
      entityId: row.id,
      actorId,
      metadata: { code: row.code, clientId: row.clientId },
    });
    return this.toDto(row);
  }

  async update(id: string, input: UpdateEquipmentInput, actorId: string): Promise<EquipmentDto> {
    const current = await this.get(id);
    if (input.code && input.code !== current.code) await this.assertCodeAvailable(current.clientId, input.code);
    const row = await this.prisma.equipment.update({ where: { id }, data: input, include: { client: clientRef } });
    await this.audit.record({
      action: AuditAction.EQUIPMENT_UPDATED,
      entityType: EntityType.EQUIPMENT,
      entityId: id,
      actorId,
      metadata: { fields: Object.keys(input) },
    });
    return this.toDto(row);
  }

  async setPhoto(id: string, file: Buffer, actorId: string): Promise<EquipmentDto> {
    await this.get(id);
    const png = await this.images.processLogo(file);
    const key = this.storage.buildKey(StorageArea.EQUIPMENT, id, 'png');
    await this.storage.put(key, png, 'image/png');
    const row = await this.prisma.equipment.update({ where: { id }, data: { photoKey: key }, include: { client: clientRef } });
    await this.audit.record({
      action: AuditAction.EQUIPMENT_UPDATED,
      entityType: EntityType.EQUIPMENT,
      entityId: id,
      actorId,
      metadata: { fields: ['photo'] },
    });
    return this.toDto(row);
  }

  private async assertCodeAvailable(clientId: string, code: string) {
    const exists = await this.prisma.equipment.findUnique({ where: { clientId_code: { clientId, code } } });
    if (exists) {
      throw AppException.conflict(ErrorCode.DUPLICATE, `El cliente ya tiene un equipo con código ${code}.`, {
        fields: { code: 'Código ya registrado para este cliente.' },
      });
    }
  }

  private async toDto(e: EquipmentWithClient): Promise<EquipmentDto> {
    return {
      id: e.id,
      clientId: e.clientId,
      client: e.client,
      code: e.code,
      name: e.name,
      category: e.category,
      brand: e.brand,
      model: e.model,
      serial: e.serial,
      location: e.location,
      description: e.description,
      specifications: e.specifications,
      notes: e.notes,
      photoUrl: await this.storage.signedUrlOrNull(e.photoKey),
      active: e.active,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
