import { createHmac } from 'node:crypto';
import { mkdir, readFile, stat, writeFile, access } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { safeEqual } from '../common/util/crypto';
import type { SignedUrlOptions, StorageDriver, StoredObject } from './storage.driver';

export const LOCAL_FILES_ROUTE = '/api/v1/files';

/**
 * Driver de disco para desarrollo y CI. Las URLs firmadas (HMAC-SHA256 + expiración)
 * las valida FilesController, de forma equivalente a una URL prefirmada de S3.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(root: string, private readonly secret: string) {
    this.root = resolve(root);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<StoredObject> {
    const path = this.pathFor(key);
    const [body, meta] = await Promise.all([readFile(path), readFile(`${path}.meta.json`, 'utf8')]);
    return { body, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, { ttlSeconds, downloadName }: SignedUrlOptions): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const params = new URLSearchParams({ exp: String(exp), sig: this.sign(key, exp, downloadName) });
    if (downloadName) params.set('dl', downloadName);
    return `${LOCAL_FILES_ROUTE}/${key.split('/').map(encodeURIComponent).join('/')}?${params.toString()}`;
  }

  verify(key: string, exp: number, sig: string, downloadName?: string): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    return safeEqual(this.sign(key, exp, downloadName), sig);
  }

  async ping(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root);
  }

  private sign(key: string, exp: number, downloadName?: string) {
    return createHmac('sha256', this.secret).update(`${key}\n${exp}\n${downloadName ?? ''}`).digest('base64url');
  }

  /** Impide path traversal: la ruta final debe quedar dentro de la raíz. */
  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Clave de almacenamiento inválida');
    return path;
  }
}
