import { Injectable } from '@nestjs/common';
import type { BrandProfile } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  type BrandProfileDto,
  type BrandProfileInput,
  type UpdateBrandProfileInput,
} from '@meca/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { AppException } from '../../common/errors/app.exception';
import { StorageArea, StorageService } from '../../storage/storage.service';
import { ImageService } from '../../media/image.service';

@Injectable()
export class BrandProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  async list(activeOnly: boolean): Promise<BrandProfileDto[]> {
    const rows = await this.prisma.brandProfile.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  async get(id: string): Promise<BrandProfileDto> {
    return this.toDto(await this.find(id));
  }

  async create(input: BrandProfileInput, actorId: string): Promise<BrandProfileDto> {
    const row = await this.prisma.brandProfile.create({ data: input });
    await this.audit.record({
      action: AuditAction.BRAND_PROFILE_CREATED,
      entityType: EntityType.BRAND_PROFILE,
      entityId: row.id,
      actorId,
      metadata: { name: row.name },
    });
    return this.toDto(row);
  }

  async update(id: string, input: UpdateBrandProfileInput, actorId: string): Promise<BrandProfileDto> {
    const current = await this.find(id);
    if (current.isDefault && input.active === false) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_ERROR, 'No se puede desactivar la empresa principal.');
    }
    const row = await this.prisma.brandProfile.update({ where: { id }, data: input });
    await this.audit.record({
      action: AuditAction.BRAND_PROFILE_UPDATED,
      entityType: EntityType.BRAND_PROFILE,
      entityId: id,
      actorId,
      metadata: { fields: Object.keys(input) },
    });
    return this.toDto(row);
  }

  async setLogo(id: string, file: Buffer, actorId: string): Promise<BrandProfileDto> {
    await this.find(id);
    const png = await this.images.processLogo(file);
    const key = this.storage.buildKey(StorageArea.BRANDING, id, 'png');
    await this.storage.put(key, png, 'image/png');
    const row = await this.prisma.brandProfile.update({ where: { id }, data: { logoKey: key } });
    await this.audit.record({
      action: AuditAction.BRAND_PROFILE_UPDATED,
      entityType: EntityType.BRAND_PROFILE,
      entityId: id,
      actorId,
      metadata: { fields: ['logo'] },
    });
    return this.toDto(row);
  }

  async find(id: string): Promise<BrandProfile> {
    const row = await this.prisma.brandProfile.findUnique({ where: { id } });
    if (!row) throw AppException.notFound('La empresa representada');
    return row;
  }

  private async toDto(b: BrandProfile): Promise<BrandProfileDto> {
    return {
      id: b.id,
      name: b.name,
      legalName: b.legalName,
      nit: b.nit,
      logoUrl: await this.storage.signedUrlOrNull(b.logoKey),
      address: b.address,
      phone: b.phone,
      email: b.email,
      website: b.website,
      primaryColor: b.primaryColor,
      secondaryColor: b.secondaryColor,
      footerText: b.footerText,
      isDefault: b.isDefault,
      active: b.active,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
