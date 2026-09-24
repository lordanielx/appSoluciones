import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  clientListQuerySchema,
  clientSchema,
  equipmentListQuerySchema,
  updateClientSchema,
  workOrderListQuerySchema,
  type ClientInput,
  type ClientListQuery,
  type EquipmentListQuery,
  type UpdateClientInput,
  type WorkOrderListQuery,
} from '@meca/shared';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { ClientsService } from '../application/clients.service';
import { EquipmentService } from '../../equipment/application/equipment.service';
import { WorkOrderQueries } from '../../work-orders/application/queries/work-order.queries';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly equipment: EquipmentService,
    private readonly workOrders: WorkOrderQueries,
  ) {}

  @Get()
  @RequirePermissions(Permission.CLIENTS_READ)
  @ApiOperation({ summary: 'Listar y buscar clientes' })
  @ApiZodQuery(clientListQuerySchema)
  list(@ZQuery(clientListQuerySchema) q: ClientListQuery) {
    return this.clients.list(q);
  }

  @Post()
  @RequirePermissions(Permission.CLIENTS_MANAGE)
  @ApiOperation({ summary: 'Crear cliente' })
  @ApiZodBody(clientSchema)
  create(@ZBody(clientSchema) body: ClientInput, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.create(body, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.CLIENTS_READ)
  @ApiOperation({ summary: 'Consultar cliente' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CLIENTS_MANAGE)
  @ApiOperation({ summary: 'Actualizar cliente (incluye activar/desactivar)' })
  @ApiZodBody(updateClientSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateClientSchema) body: UpdateClientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clients.update(id, body, user.id);
  }

  @Get(':id/equipment')
  @RequirePermissions(Permission.EQUIPMENT_READ)
  @ApiOperation({ summary: 'Equipos del cliente' })
  @ApiZodQuery(equipmentListQuerySchema)
  listEquipment(@Param('id', ParseUUIDPipe) id: string, @ZQuery(equipmentListQuerySchema) q: EquipmentListQuery) {
    return this.equipment.list({ ...q, clientId: id });
  }

  @Get(':id/work-orders')
  @RequirePermissions(Permission.WORK_ORDERS_READ_ALL)
  @ApiOperation({ summary: 'Histórico de servicios del cliente' })
  @ApiZodQuery(workOrderListQuerySchema)
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @ZQuery(workOrderListQuerySchema) q: WorkOrderListQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.list({ ...q, clientId: id }, user);
  }
}
