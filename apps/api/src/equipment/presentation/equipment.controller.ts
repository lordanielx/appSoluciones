import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ErrorCode,
  Permission,
  equipmentListQuerySchema,
  equipmentSchema,
  updateEquipmentSchema,
  type EquipmentInput,
  type EquipmentListQuery,
  type UpdateEquipmentInput,
} from '@meca/shared';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { SingleFileUpload, multipartFileSchema } from '../../common/http/upload';
import { AppException } from '../../common/errors/app.exception';
import { EquipmentService } from '../application/equipment.service';

@ApiTags('Equipos')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  @RequirePermissions(Permission.EQUIPMENT_READ)
  @ApiOperation({ summary: 'Listar y buscar equipos (código, nombre, serial, marca, cliente)' })
  @ApiZodQuery(equipmentListQuerySchema)
  list(@ZQuery(equipmentListQuerySchema) q: EquipmentListQuery) {
    return this.equipment.list(q);
  }

  @Post()
  @RequirePermissions(Permission.EQUIPMENT_MANAGE)
  @ApiOperation({ summary: 'Registrar equipo' })
  @ApiZodBody(equipmentSchema)
  create(@ZBody(equipmentSchema) body: EquipmentInput, @CurrentUser() user: AuthenticatedUser) {
    return this.equipment.create(body, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.EQUIPMENT_READ)
  @ApiOperation({ summary: 'Consultar equipo' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipment.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EQUIPMENT_MANAGE)
  @ApiOperation({ summary: 'Actualizar equipo (incluye activar/desactivar)' })
  @ApiZodBody(updateEquipmentSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateEquipmentSchema) body: UpdateEquipmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipment.update(id, body, user.id);
  }

  @Post(':id/photo')
  @RequirePermissions(Permission.EQUIPMENT_MANAGE)
  @UseInterceptors(SingleFileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: multipartFileSchema() })
  @ApiOperation({ summary: 'Cargar fotografía del equipo' })
  photo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw AppException.badRequest(ErrorCode.FILE_INVALID, 'Adjunte una imagen.');
    return this.equipment.setPhoto(id, file.buffer, user.id);
  }
}
