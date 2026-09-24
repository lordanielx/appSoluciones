import { Global, Module } from '@nestjs/common';
import { AuditService } from './application/audit.service';
import { AuditController } from './presentation/audit.controller';

@Global()
@Module({ providers: [AuditService], exports: [AuditService], controllers: [AuditController] })
export class AuditModule {}
