import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  booleanQuery,
  serviceTypeSchema,
  updateServiceTypeSchema,
  type ServiceTypeInput,
  type UpdateServiceTypeInput,
} from '@meca/shared';
import { z } from 'zod';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { ServiceTypesService } from '../application/service-types.service';

const listQuery = z.object({ active: booleanQuery });

@ApiTags('Tipos de servicio')
@ApiBearerAuth()
@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypes: ServiceTypesService) {}

  @Get()
  @RequireAnyPermission(Permission.CHECKLISTS_READ, Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Listar tipos de servicio' })
  @ApiZodQuery(listQuery)
  list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) {
    return this.serviceTypes.list(q.active === true);
  }

  @Post()
  @RequirePermissions(Permission.SERVICE_TYPES_MANAGE)
  @ApiOperation({ summary: 'Crear tipo de servicio' })
  @ApiZodBody(serviceTypeSchema)
  create(@ZBody(serviceTypeSchema) body: ServiceTypeInput, @CurrentUser() user: AuthenticatedUser) {
    return this.serviceTypes.create(body, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SERVICE_TYPES_MANAGE)
  @ApiOperation({ summary: 'Actualizar tipo de servicio' })
  @ApiZodBody(updateServiceTypeSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateServiceTypeSchema) body: UpdateServiceTypeInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceTypes.update(id, body, user.id);
  }
}
