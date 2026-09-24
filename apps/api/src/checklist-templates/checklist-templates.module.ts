import { Module } from '@nestjs/common';
import { ChecklistTemplatesService } from './application/checklist-templates.service';
import { ChecklistTemplatesController } from './presentation/checklist-templates.controller';

@Module({ providers: [ChecklistTemplatesService], controllers: [ChecklistTemplatesController] })
export class ChecklistTemplatesModule {}
