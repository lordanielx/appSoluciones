import { Module } from '@nestjs/common';
import { EquipmentService } from './application/equipment.service';
import { EquipmentController } from './presentation/equipment.controller';

@Module({ providers: [EquipmentService], controllers: [EquipmentController], exports: [EquipmentService] })
export class EquipmentModule {}
