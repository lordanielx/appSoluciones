import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://meca:meca@localhost:5432/mecaelectric_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
process.env.STORAGE_DRIVER = 'local';
process.env.LOCAL_STORAGE_DIR = join(tmpdir(), 'meca-test-storage');
process.env.STORAGE_SIGNING_SECRET = 'test-storage-signing-secret';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
