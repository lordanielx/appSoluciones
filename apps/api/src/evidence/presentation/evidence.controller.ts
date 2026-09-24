import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, Permission, evidenceMetaSchema } from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { SingleFileUpload, multipartFileSchema } from '../../common/http/upload';
import { AppException } from '../../common/errors/app.exception';
import { ZodValidationPipe } from '../../common/zod/zod.pipe';
import { EvidenceService, type EvidenceMeta } from '../application/evidence.service';

@ApiTags('Evidencias')
@ApiBearerAuth()
@Controller('work-orders/:id/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  @RequireAnyPermission(Permission.WORK_ORDERS_READ_ALL, Permission.WORK_ORDERS_READ_OWN)
  @ApiOperation({ summary: 'Evidencias vigentes con URLs firmadas (imagen y thumbnail)' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidence.list(id, user);
  }

  @Post()
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @UseInterceptors(SingleFileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartFileSchema({
      id: { type: 'string', format: 'uuid', description: 'UUID generado en el dispositivo (idempotencia)' },
      checklistResponseId: { type: 'string', format: 'uuid' },
      caption: { type: 'string' },
      capturedAt: { type: 'string', format: 'date-time' },
    }),
  })
  @ApiOperation({ summary: 'Adjuntar fotografía (se recomprime, corrige orientación y genera thumbnail)' })
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(evidenceMetaSchema)) meta: EvidenceMeta,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw AppException.badRequest(ErrorCode.FILE_INVALID, 'Adjunte la fotografía.');
    return this.evidence.add(id, meta, file.buffer, user);
  }

  @Delete(':evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @ApiOperation({ summary: 'Retirar evidencia (borrado lógico; se conserva para auditoría)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.evidence.remove(id, evidenceId, user);
  }
}
