export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface SignedUrlOptions {
  ttlSeconds: number;
  /** Nombre sugerido de descarga (Content-Disposition). */
  downloadName?: string;
}

/** Abstracción de object storage. Nunca se guardan binarios en PostgreSQL. */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  exists(key: string): Promise<boolean>;
  signedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  /** Verificación de conectividad para /health/ready. */
  ping(): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
