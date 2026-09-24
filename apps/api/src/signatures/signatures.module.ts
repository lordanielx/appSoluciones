import { Module } from '@nestjs/common';
import { WorkOrderCoreModule } from '../work-orders/work-order-core.module';
import { SignaturesService } from './application/signatures.service';
import { SignaturesController } from './presentation/signatures.controller';

@Module({ imports: [WorkOrderCoreModule], providers: [SignaturesService], controllers: [SignaturesController] })
export class SignaturesModule {}
