/** Lado largo máximo de la evidencia (el servidor vuelve a normalizar). */
export const EVIDENCE_MAX_PX = 1920;
export const THUMB_MAX_PX = 360;
const JPEG_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export interface CompressedImage {
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
}

/**
 * Comprime en el dispositivo antes de guardar/subir: corrige orientación EXIF
 * (createImageBitmap con imageOrientation 'from-image'), limita resolución y genera thumbnail.
 * Reduce datos móviles y espacio en IndexedDB mientras el técnico está sin señal.
 */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const source = await decode(file);
  try {
    const full = await render(source, EVIDENCE_MAX_PX, JPEG_QUALITY);
    const thumb = await render(source, THUMB_MAX_PX, THUMB_QUALITY);
    return { blob: full.blob, thumbnail: thumb.blob, width: full.width, height: full.height };
  } finally {
    if ('close' in source) source.close();
  }
}

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<Source> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* formato no soportado por createImageBitmap: se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('No fue posible leer la imagen. Use una fotografía JPEG o PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function render(source: Source, max: number, quality: number) {
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El dispositivo no permite procesar imágenes.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('No fue posible comprimir la imagen.');
  return { blob, width, height };
}
