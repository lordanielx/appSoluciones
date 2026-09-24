import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, Permission, signatureMetaSchema } from '@meca/shared';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { SingleFileUpload, multipartFileSchema } from '../../common/http/upload';
import { AppException } from '../../common/errors/app.exception';
import { ZodValidationPipe } from '../../common/zod/zod.pipe';
import { SignaturesService, type SignatureMeta } from '../application/signatures.service';

@ApiTags('Firmas')
@ApiBearerAuth()
@Controller('work-orders/:id/signatures')
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) {}

  @Get()
  @RequireAnyPermission(Permission.WORK_ORDERS_READ_ALL, Permission.WORK_ORDERS_READ_OWN)
  @ApiOperation({ summary: 'Firmas vigentes de la OT' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.signatures.list(id, user);
  }

  @Post()
  @RequirePermissions(Permission.WORK_ORDERS_EXECUTE)
  @UseInterceptors(SingleFileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartFileSchema({
      id: { type: 'string', format: 'uuid' },
      signatureType: { type: 'string', enum: ['TECHNICIAN', 'CLIENT'] },
      signerName: { type: 'string' },
      signerRole: { type: 'string' },
      signedAt: { type: 'string', format: 'date-time' },
      consentAccepted: { type: 'boolean' },
      strokes: { type: 'string', description: 'JSON {width,height,strokes:[[[x,y],...]]}' },
    }),
  })
  @ApiOperation({ summary: 'Registrar firma de conformidad (PNG + trazos vectoriales)' })
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(signatureMetaSchema)) meta: SignatureMeta,
    @Body('strokes') strokes: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw AppException.badRequest(ErrorCode.FILE_INVALID, 'Adjunte la imagen de la firma.');
    return this.signatures.add(id, meta, file.buffer, strokes, user);
  }
}
