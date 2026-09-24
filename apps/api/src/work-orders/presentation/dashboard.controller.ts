import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@meca/shared';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { WorkOrderQueries } from '../application/queries/work-order.queries';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly queries: WorkOrderQueries) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Indicadores operativos, órdenes recientes y actividad' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.queries.dashboard(user);
  }
}
