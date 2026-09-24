import { Module } from '@nestjs/common';
import { BrandProfilesService } from './application/brand-profiles.service';
import { BrandProfilesController } from './presentation/brand-profiles.controller';

@Module({ providers: [BrandProfilesService], controllers: [BrandProfilesController], exports: [BrandProfilesService] })
export class BrandProfilesModule {}
