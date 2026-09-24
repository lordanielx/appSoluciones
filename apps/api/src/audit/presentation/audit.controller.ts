import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, paginationQuerySchema } from '@meca/shared';
import { z } from 'zod';
import { RequirePermissions } from '../../common/auth/decorators';
import { ApiZodQuery, ZQuery } from '../../common/zod/zod.decorators';
import { AuditService } from '../application/audit.service';

const auditQuerySchema = paginationQuerySchema.extend({
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().max(60).optional(),
});

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Consultar registro de auditoría' })
  @ApiZodQuery(auditQuerySchema)
  list(@ZQuery(auditQuerySchema) q: z.infer<typeof auditQuerySchema>) {
    return this.audit.list(q);
  }
}
