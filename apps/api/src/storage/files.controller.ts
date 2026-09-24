import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { LocalStorageDriver } from './local.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

/** Sirve archivos del driver local mediante URL firmada (equivalente a prefirmado S3). */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  @Public()
  @Get('*path')
  async serve(
    @Param('path') path: string | string[],
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('dl') dl: string | undefined,
    @Res() res: Response,
  ) {
    if (!(this.driver instanceof LocalStorageDriver)) throw AppException.notFound('El archivo');
    const key = Array.isArray(path) ? path.join('/') : path;
    if (!sig || !this.driver.verify(key, Number(exp), sig, dl)) {
      throw AppException.forbidden('El enlace del archivo expiró o no es válido.');
    }
    let file;
    try {
      file = await this.driver.get(key);
    } catch {
      throw AppException.notFound('El archivo');
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (dl) res.setHeader('Content-Disposition', `inline; filename="${dl.replace(/[^\w.-]/g, '_')}"`);
    res.end(file.body);
  }
}
