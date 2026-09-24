import { Injectable } from '@nestjs/common';
import type { Client, Prisma } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  type ClientDto,
  type ClientInput,
  type ClientListQuery,
  type Paginated,
  type UpdateClientInput,
} from '@meca/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { AppException } from '../../common/errors/app.exception';
import { paginated, skipTake } from '../../common/util/pagination';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ClientListQuery): Promise<Paginated<ClientDto>> {
    const where: Prisma.ClientWhereInput = {
      active: q.active,
      ...(q.q
        ? {
            OR: [
              { legalName: { contains: q.q, mode: 'insensitive' } },
              { tradeName: { contains: q.q, mode: 'insensitive' } },
              { nit: { contains: q.q.replace(/[.\s-]/g, '') } },
              { city: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { legalName: 'asc' },
        include: { _count: { select: { equipment: true } } },
        ...skipTake(q),
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({ ...toClientDto(r), equipmentCount: r._count.equipment })),
      total,
      q,
    );
  }

  async get(id: string): Promise<ClientDto> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { equipment: true } } },
    });
    if (!client) throw AppException.notFound('El cliente');
    return { ...toClientDto(client), equipmentCount: client._count.equipment };
  }

  async create(input: ClientInput, actorId: string): Promise<ClientDto> {
    await this.assertNitAvailable(input.nit);
    const client = await this.prisma.client.create({ data: input });
    await this.audit.record({
      action: AuditAction.CLIENT_CREATED,
      entityType: EntityType.CLIENT,
      entityId: client.id,
      actorId,
      metadata: { legalName: client.legalName, nit: client.nit },
    });
    return toClientDto(client);
  }

  async update(id: string, input: UpdateClientInput, actorId: string): Promise<ClientDto> {
    const current = await this.get(id);
    if (input.nit && input.nit !== current.nit) await this.assertNitAvailable(input.nit);
    const client = await this.prisma.client.update({ where: { id }, data: input });
    await this.audit.record({
      action: AuditAction.CLIENT_UPDATED,
      entityType: EntityType.CLIENT,
      entityId: id,
      actorId,
      metadata: { fields: Object.keys(input) },
    });
    return toClientDto(client);
  }

  private async assertNitAvailable(nit: string) {
    const exists = await this.prisma.client.findUnique({ where: { nit } });
    if (exists) {
      throw AppException.conflict(ErrorCode.DUPLICATE, `Ya existe un cliente con NIT ${nit}.`, {
        fields: { nit: 'NIT ya registrado.' },
      });
    }
  }
}

export function toClientDto(c: Client): ClientDto {
  return {
    id: c.id,
    legalName: c.legalName,
    tradeName: c.tradeName,
    nit: c.nit,
    dv: c.dv,
    contactName: c.contactName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    department: c.department,
    notes: c.notes,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
