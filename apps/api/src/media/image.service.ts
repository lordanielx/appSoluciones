import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ErrorCode } from '@meca/shared';
import { AppException } from '../common/errors/app.exception';

/** Resolución máxima del lado largo para evidencias (suficiente para informe técnico). */
export const EVIDENCE_MAX_DIMENSION = 1920;
export const THUMBNAIL_MAX_DIMENSION = 360;
export const LOGO_MAX_DIMENSION = 800;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const JPEG_QUALITY = 82;
const THUMB_QUALITY = 70;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export interface ProcessedImage {
  full: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
}

@Injectable()
export class ImageService {
  /**
   * Valida por contenido real (no por extensión ni MIME declarado), corrige orientación EXIF,
   * elimina metadatos, limita resolución y genera thumbnail.
   */
  async processPhoto(input: Buffer): Promise<ProcessedImage> {
    await this.assertImage(input);
    const base = sharp(input, { failOn: 'error' }).rotate();
    const { data: full, info } = await base
      .clone()
      .resize({ width: EVIDENCE_MAX_DIMENSION, height: EVIDENCE_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumbnail = await base
      .clone()
      .resize({ width: THUMBNAIL_MAX_DIMENSION, height: THUMBNAIL_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
    return { full, thumbnail, width: info.width, height: info.height, mimeType: 'image/jpeg' };
  }

  /** Logos de marca y fotos de equipo: PNG normalizado (conserva transparencia). */
  async processLogo(input: Buffer): Promise<Buffer> {
    await this.assertImage(input);
    return sharp(input)
      .rotate()
      .resize({ width: LOGO_MAX_DIMENSION, height: LOGO_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  /** Firma: PNG generado en el dispositivo; se normaliza y valida. */
  async processSignaturePng(input: Buffer): Promise<Buffer> {
    const meta = await this.assertImage(input);
    if (meta.format !== 'png') {
      throw AppException.badRequest(ErrorCode.FILE_INVALID, 'La firma debe enviarse en formato PNG.');
    }
    return sharp(input).resize({ width: 900, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  }

  private async assertImage(input: Buffer) {
    if (input.length > MAX_UPLOAD_BYTES) {
      throw AppException.badRequest(ErrorCode.FILE_TOO_LARGE, 'La imagen supera el tamaño máximo de 15 MB.');
    }
    try {
      const meta = await sharp(input).metadata();
      if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new Error('format');
      if ((meta.width ?? 0) * (meta.height ?? 0) > 60_000_000) throw new Error('pixels');
      return meta;
    } catch {
      throw AppException.badRequest(
        ErrorCode.FILE_INVALID,
        'El archivo no es una imagen válida. Formatos permitidos: JPEG, PNG o WebP.',
      );
    }
  }
}
