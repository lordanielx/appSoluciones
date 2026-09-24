import { Module } from '@nestjs/common';
import { ServiceTypesService } from './application/service-types.service';
import { ServiceTypesController } from './presentation/service-types.controller';

@Module({ providers: [ServiceTypesService], controllers: [ServiceTypesController] })
export class ServiceTypesModule {}
