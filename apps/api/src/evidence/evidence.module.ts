import { Module } from '@nestjs/common';
import { WorkOrderCoreModule } from '../work-orders/work-order-core.module';
import { EvidenceService } from './application/evidence.service';
import { EvidenceController } from './presentation/evidence.controller';

@Module({
  imports: [WorkOrderCoreModule],
  providers: [EvidenceService],
  controllers: [EvidenceController],
  exports: [EvidenceService],
})
export class EvidenceModule {}
