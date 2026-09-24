import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  checklistTemplateListQuerySchema,
  checklistTemplateSchema,
  updateChecklistTemplateSchema,
  type ChecklistTemplateData,
  type ChecklistTemplateListQuery,
} from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { ChecklistTemplatesService, type UpdateTemplateData } from '../application/checklist-templates.service';

@ApiTags('Plantillas de checklist')
@ApiBearerAuth()
@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly templates: ChecklistTemplatesService) {}

  @Get()
  @RequireAnyPermission(Permission.CHECKLISTS_READ, Permission.CHECKLISTS_MANAGE)
  @ApiOperation({ summary: 'Listar plantillas' })
  @ApiZodQuery(checklistTemplateListQuerySchema)
  list(@ZQuery(checklistTemplateListQuerySchema) q: ChecklistTemplateListQuery) {
    return this.templates.list(q);
  }

  @Post()
  @RequirePermissions(Permission.CHECKLISTS_MANAGE)
  @ApiOperation({ summary: 'Crear plantilla con sus actividades' })
  @ApiZodBody(checklistTemplateSchema)
  create(@ZBody(checklistTemplateSchema) body: ChecklistTemplateData, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.create(body, user.id);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.CHECKLISTS_READ, Permission.CHECKLISTS_MANAGE)
  @ApiOperation({ summary: 'Consultar plantilla con actividades' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CHECKLISTS_MANAGE)
  @ApiOperation({ summary: 'Actualizar plantilla (reemplazar actividades incrementa la versión)' })
  @ApiZodBody(updateChecklistTemplateSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateChecklistTemplateSchema) body: UpdateTemplateData,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.templates.update(id, body, user.id);
  }
}
