import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { STORAGE_DRIVER, type StorageDriver, type StoredObject } from './storage.driver';

export const StorageArea = {
  EVIDENCE: 'evidence',
  SIGNATURES: 'signatures',
  REPORTS: 'reports',
  BRANDING: 'branding',
  EQUIPMENT: 'equipment',
} as const;
export type StorageArea = (typeof StorageArea)[keyof typeof StorageArea];

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  /**
   * Clave aleatoria organizada por área/año/mes/entidad. Nunca usa el nombre original del archivo.
   * Ej.: evidence/2026/09/<workOrderId>/<uuid>.jpg
   */
  buildKey(area: StorageArea, scopeId: string, extension: string, suffix = ''): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${area}/${yyyy}/${mm}/${scopeId}/${randomUUID()}${suffix}.${extension}`;
  }

  put(key: string, body: Buffer, contentType: string) {
    return this.driver.put(key, body, contentType);
  }

  get(key: string): Promise<StoredObject> {
    return this.driver.get(key);
  }

  exists(key: string) {
    return this.driver.exists(key);
  }

  signedUrl(key: string, downloadName?: string) {
    return this.driver.signedUrl(key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS, downloadName });
  }

  async signedUrlOrNull(key: string | null | undefined) {
    return key ? this.signedUrl(key) : null;
  }

  ping() {
    return this.driver.ping();
  }

  async dataUri(key: string): Promise<string> {
    const obj = await this.get(key);
    return `data:${obj.contentType};base64,${obj.body.toString('base64')}`;
  }
}
