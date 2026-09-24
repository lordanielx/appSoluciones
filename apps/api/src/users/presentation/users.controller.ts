import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
  userStatusSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListQuery,
  type UserStatusInput,
} from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod/zod.decorators';
import { UsersService } from '../application/users.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Listar usuarios' })
  @ApiZodQuery(userListQuerySchema)
  list(@ZQuery(userListQuerySchema) q: UserListQuery) {
    return this.users.list(q);
  }

  @Get('technicians')
  @RequireAnyPermission(Permission.WORK_ORDERS_ASSIGN, Permission.WORK_ORDERS_READ_ALL)
  @ApiOperation({ summary: 'Técnicos activos disponibles para asignación' })
  technicians() {
    return this.users.technicians();
  }

  @Post()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiZodBody(createUserSchema)
  create(@ZBody(createUserSchema) body: CreateUserInput, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.create(body, actor.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Consultar usuario' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Actualizar usuario' })
  @ApiZodBody(updateUserSchema)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateUserSchema) body: UpdateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, body, actor.id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Activar o desactivar usuario' })
  @ApiZodBody(userStatusSchema)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(userStatusSchema) body: UserStatusInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.setStatus(id, body.active, actor.id);
  }
}
