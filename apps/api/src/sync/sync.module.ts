import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { ChecklistExecutionModule } from '../checklist-execution/checklist-execution.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { SyncService } from './application/sync.service';
import { SyncController } from './presentation/sync.controller';

@Module({
  imports: [WorkOrdersModule, ChecklistExecutionModule, EvidenceModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
