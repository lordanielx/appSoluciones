import { Module } from '@nestjs/common';
import { WorkOrderCoreModule } from '../work-orders/work-order-core.module';
import { ChecklistExecutionService } from './application/checklist-execution.service';
import { ChecklistExecutionController } from './presentation/checklist-execution.controller';

@Module({
  imports: [WorkOrderCoreModule],
  providers: [ChecklistExecutionService],
  controllers: [ChecklistExecutionController],
  exports: [ChecklistExecutionService],
})
export class ChecklistExecutionModule {}
