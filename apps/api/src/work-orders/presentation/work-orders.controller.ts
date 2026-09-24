import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  assignWorkOrderSchema,
  cancelWorkOrderSchema,
  clientSignatureWaiverSchema,
  createWorkOrderSchema,
  rejectWorkOrderSchema,
  requestChangesSchema,
  technicianNotesSchema,
  updateWorkOrderSchema,
  workOrderListQuerySchema,
  type AssignWorkOrderInput,
  type CreateWorkOrderData,
  type RequestChangesInput,
  type TechnicianNotesInput,
  type UpdateWorkOrderData,
  type WorkOrderListQuery,
} from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { WorkOrderQueries } from '../application/queries/work-order.queries';
import { WorkOrderEditingCommands } from '../application/commands/work-order-editing.commands';
import { WorkOrderLifecycleCommands } from '../application/commands/work-order-lifecycle.commands';

const READ = [Permission.WORK_ORDERS_READ_ALL, Permission.WORK_ORDERS_READ_OWN] as const;

/**
 * Controlador delgado: valida entrada (Zod) y delega en comandos/consultas.
 * Toda regla de negocio y de permisos por orden vive en la capa de aplicación/dominio.
 */
@ApiTags('Órdenes de trabajo')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly queries: WorkOrderQueries,
    private readonly editing: WorkOrderEditingCommands,
    private readonly lifecycle: WorkOrderLifecycleCommands,
  ) {}

  @Get()
  @RequireAnyPermission(...READ)
  @ApiOperation({ summary: 'Listar y buscar OT (número, cliente, equipo, serial, técnico). El técnico solo ve las suyas.' })
  @ApiZodQuery(workOrderListQuerySchema)
  list(@ZQuery(workOrderListQuerySchema) q: WorkOrderListQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.list(q, user);
  }

  @Post()
  @RequirePermissions(Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Crear OT (DRAFT, o ASSIGNED si assignNow=true)' })
  @ApiZodBody(createWorkOrderSchema)
  async create(@ZBody(createWorkOrderSchema) body: CreateWorkOrderData, @CurrentUser() user: AuthenticatedUser) {
    const id = await this.editing.create(body, user);
    return this.queries.detail(id, user);
  }

  @Get(':id')
  @RequireAnyPermission(...READ)
  @ApiOperation({ summary: 'Detalle de la OT con acciones disponibles para el usuario' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.detail(id, user);
  }

  @Get(':id/bundle')
  @RequireAnyPermission(...READ)
  @ApiOperation({ summary: 'OT + checklist + evidencias + firmas + estados (descarga offline y revisión)' })
  bundle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.bundle(id, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Editar OT (requiere `version` para concurrencia optimista)' })
  @ApiZodBody(updateWorkOrderSchema)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateWorkOrderSchema) body: UpdateWorkOrderData,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.editing.update(id, body, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_ASSIGN)
  @ApiOperation({ summary: 'Asignar o reasignar técnico (→ ASSIGNED)' })
  @ApiZodBody(assignWorkOrderSchema)
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(assignWorkOrderSchema) body: AssignWorkOrderInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.editing.assign(id, body.technicianId, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Técnico acepta el servicio (→ ACCEPTED)' })
  async accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lifecycle.accept(id, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Técnico rechaza la asignación con motivo (→ REJECTED)' })
  @ApiZodBody(rejectWorkOrderSchema)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(rejectWorkOrderSchema) body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.lifecycle.reject(id, body.reason, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Iniciar o retomar el servicio (→ IN_PROGRESS)' })
  async start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lifecycle.start(id, user);
    return this.queries.detail(id, user);
  }

  @Patch(':id/technician-notes')
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Observaciones y conclusiones técnicas' })
  @ApiZodBody(technicianNotesSchema)
  async notes(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(technicianNotesSchema) body: TechnicianNotesInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.lifecycle.updateTechnicianNotes(id, body.technicianNotes, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Enviar a revisión; 422 con la lista exacta de pendientes si falta algo (→ PENDING_REVIEW)' })
  async submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lifecycle.submit(id, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/client-signature-waiver')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_WAIVE_CLIENT_SIGNATURE)
  @ApiOperation({ summary: 'Registrar excepción administrativa a la firma del cliente (RB-010)' })
  @ApiZodBody(clientSignatureWaiverSchema)
  async waive(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(clientSignatureWaiverSchema) body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.lifecycle.waiveClientSignature(id, body.reason, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_REVIEW)
  @ApiOperation({ summary: 'Solicitar corrección con comentario (→ CHANGES_REQUESTED)' })
  @ApiZodBody(requestChangesSchema)
  async requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(requestChangesSchema) body: RequestChangesInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.lifecycle.requestChanges(id, body.comment, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_REVIEW)
  @ApiOperation({ summary: 'Aprobar informe y generar PDF definitivo versionado (→ APPROVED)' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const { report } = await this.lifecycle.approve(id, user);
    return { workOrder: await this.queries.detail(id, user), report };
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Cerrar orden aprobada (→ CLOSED)' })
  async close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lifecycle.close(id, user);
    return this.queries.detail(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WORK_ORDERS_MANAGE)
  @ApiOperation({ summary: 'Anular orden con motivo (→ CANCELLED)' })
  @ApiZodBody(cancelWorkOrderSchema)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(cancelWorkOrderSchema) body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.lifecycle.cancel(id, body.reason, user);
    return this.queries.detail(id, user);
  }

  @Get(':id/history')
  @RequireAnyPermission(...READ)
  @ApiOperation({ summary: 'Timeline de auditoría de la OT' })
  history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.history(id, user);
  }

  @Get(':id/status-history')
  @RequireAnyPermission(...READ)
  @ApiOperation({ summary: 'Historial de cambios de estado' })
  async statusHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.queries.detail(id, user);
    return this.queries.statusHistory(id);
  }
}
