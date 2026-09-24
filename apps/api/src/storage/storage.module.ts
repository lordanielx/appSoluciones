import { Global, Module } from '@nestjs/common';
import { env } from '../config/env';
import { FilesController } from './files.controller';
import { LocalStorageDriver } from './local.driver';
import { S3StorageDriver } from './s3.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      useFactory: (): StorageDriver => {
        const c = env();
        if (c.STORAGE_DRIVER === 's3') {
          return new S3StorageDriver({
            endpoint: c.S3_ENDPOINT,
            publicEndpoint: c.S3_PUBLIC_ENDPOINT,
            region: c.S3_REGION,
            bucket: c.S3_BUCKET,
            accessKeyId: c.S3_ACCESS_KEY as string,
            secretAccessKey: c.S3_SECRET_KEY as string,
            forcePathStyle: c.S3_FORCE_PATH_STYLE,
          });
        }
        return new LocalStorageDriver(c.LOCAL_STORAGE_DIR, c.STORAGE_SIGNING_SECRET);
      },
    },
    StorageService,
  ],
  controllers: [FilesController],
  exports: [StorageService, STORAGE_DRIVER],
})
export class StorageModule {}
