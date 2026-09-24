import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, updateChecklistResponseSchema } from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ZBody } from '../../common/zod/zod.decorators';
import { ChecklistExecutionService, type ResponseUpdate } from '../application/checklist-execution.service';

@ApiTags('Ejecución de checklist')
@ApiBearerAuth()
@Controller('work-orders/:id/checklist')
export class ChecklistExecutionController {
  constructor(private readonly service: ChecklistExecutionService) {}

  @Get()
  @RequireAnyPermission(Permission.WORK_ORDERS_READ_ALL, Permission.WORK_ORDERS_READ_OWN)
  @ApiOperation({ summary: 'Actividades del checklist de la OT con sus respuestas' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }

  @Patch('responses/:responseId')
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Registrar respuesta (409 VERSION_CONFLICT si cambió en otro dispositivo)' })
  @ApiZodBody(updateChecklistResponseSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @ZBody(updateChecklistResponseSchema) body: ResponseUpdate,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, responseId, body, user);
  }
}
