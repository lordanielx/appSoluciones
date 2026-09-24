import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission, syncBatchSchema } from '@meca/shared';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ZBody } from '../../common/zod/zod.decorators';
import { SyncService, type SyncOperation } from '../application/sync.service';

@ApiTags('Sincronización offline')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('pull')
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Descarga de órdenes activas del técnico para trabajo offline' })
  pull(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.pull(user);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({
    summary: 'Aplicar operaciones del outbox en orden (idempotente por clientOperationId)',
    description: 'Cada resultado es APPLIED, DUPLICATE, CONFLICT (versión) o REJECTED (regla de negocio).',
  })
  @ApiZodBody(syncBatchSchema)
  batch(@ZBody(syncBatchSchema) body: { operations: SyncOperation[] }, @CurrentUser() user: AuthenticatedUser) {
    return this.sync.applyBatch(body.operations, user).then((results) => ({ results }));
  }
}
