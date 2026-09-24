import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ErrorCode,
  Permission,
  booleanQuery,
  brandProfileSchema,
  updateBrandProfileSchema,
  type BrandProfileInput,
  type UpdateBrandProfileInput,
} from '@meca/shared';
import { z } from 'zod';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { SingleFileUpload, multipartFileSchema } from '../../common/http/upload';
import { AppException } from '../../common/errors/app.exception';
import { BrandProfilesService } from '../application/brand-profiles.service';

const listQuery = z.object({ active: booleanQuery });

@ApiTags('Empresas representadas')
@ApiBearerAuth()
@Controller('brand-profiles')
export class BrandProfilesController {
  constructor(private readonly brands: BrandProfilesService) {}

  @Get()
  @RequireAnyPermission(Permission.BRANDS_MANAGE, Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Listar empresas representadas (perfiles de marca documental)' })
  @ApiZodQuery(listQuery)
  list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) {
    return this.brands.list(q.active === true);
  }

  @Post()
  @RequirePermissions(Permission.BRANDS_MANAGE)
  @ApiOperation({ summary: 'Crear empresa representada' })
  @ApiZodBody(brandProfileSchema)
  create(@ZBody(brandProfileSchema) body: BrandProfileInput, @CurrentUser() user: AuthenticatedUser) {
    return this.brands.create(body, user.id);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.BRANDS_MANAGE, Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Consultar empresa representada' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.brands.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BRANDS_MANAGE)
  @ApiOperation({ summary: 'Actualizar empresa representada' })
  @ApiZodBody(updateBrandProfileSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateBrandProfileSchema) body: UpdateBrandProfileInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.brands.update(id, body, user.id);
  }

  @Post(':id/logo')
  @RequirePermissions(Permission.BRANDS_MANAGE)
  @UseInterceptors(SingleFileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: multipartFileSchema() })
  @ApiOperation({ summary: 'Cargar logo (PNG/JPEG/WebP; se normaliza a PNG)' })
  logo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw AppException.badRequest(ErrorCode.FILE_INVALID, 'Adjunte el logo.');
    return this.brands.setLogo(id, file.buffer, user.id);
  }
}
