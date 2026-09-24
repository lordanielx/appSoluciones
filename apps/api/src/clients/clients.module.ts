import { Module } from '@nestjs/common';
import { EquipmentModule } from '../equipment/equipment.module';
import { WorkOrderCoreModule } from '../work-orders/work-order-core.module';
import { ClientsService } from './application/clients.service';
import { ClientsController } from './presentation/clients.controller';

@Module({ imports: [EquipmentModule, WorkOrderCoreModule], providers: [ClientsService], controllers: [ClientsController] })
export class ClientsModule {}
