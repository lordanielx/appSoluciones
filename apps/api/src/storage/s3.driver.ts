import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { SignedUrlOptions, StorageDriver, StoredObject } from './storage.driver';

export interface S3DriverConfig {
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Driver S3 compatible (MinIO en desarrollo, S3/R2/Spaces en producción). */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  /** Cliente para firmar URLs con el host que ve el navegador. */
  private readonly publicClient: S3Client;

  constructor(private readonly config: S3DriverConfig) {
    const base = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    };
    this.client = new S3Client({ ...base, endpoint: config.endpoint });
    this.publicClient = new S3Client({ ...base, endpoint: config.publicEndpoint ?? config.endpoint });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Objeto vacío: ${key}`);
    return { body: Buffer.from(bytes), contentType: out.ContentType ?? 'application/octet-stream' };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  signedUrl(key: string, { ttlSeconds, downloadName }: SignedUrlOptions): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `inline; filename="${downloadName}"` : undefined,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }
}
