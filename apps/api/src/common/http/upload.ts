import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_UPLOAD_BYTES } from '../../media/image.service';

/** Interceptor multipart: memoria, un solo archivo, tamaño limitado. Los binarios van luego a object storage. */
export const SingleFileUpload = (field = 'file') =>
  FileInterceptor(field, {
    storage: memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20, fieldSize: 64 * 1024 },
  });

export const multipartFileSchema = (extra: Record<string, unknown> = {}) => ({
  type: 'object',
  properties: { file: { type: 'string', format: 'binary' }, ...extra },
  required: ['file'],
});
