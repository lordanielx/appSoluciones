import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { WorkOrderCoreModule } from './work-order-core.module';
import { WorkOrderEditingCommands } from './application/commands/work-order-editing.commands';
import { WorkOrderLifecycleCommands } from './application/commands/work-order-lifecycle.commands';
import { WorkOrdersController } from './presentation/work-orders.controller';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [WorkOrderCoreModule, ReportsModule],
  providers: [WorkOrderEditingCommands, WorkOrderLifecycleCommands],
  controllers: [WorkOrdersController, DashboardController],
  exports: [WorkOrderLifecycleCommands, WorkOrderCoreModule],
})
export class WorkOrdersModule {}
