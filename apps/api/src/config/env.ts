import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Carga el .env de la raíz del monorepo si existe (Node >= 21 lo soporta de forma nativa). */
export function loadDotEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  const file = candidates.find((f) => existsSync(f));
  if (file) process.loadEnvFile(file);
}

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(3000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
    API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener mínimo 32 caracteres'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(14),
    COOKIE_SECURE: bool,
    STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
    S3_ENDPOINT: z.string().optional(),
    S3_PUBLIC_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('mecaelectric'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,
    LOCAL_STORAGE_DIR: z.string().default('./storage-data'),
    STORAGE_SIGNING_SECRET: z.string().min(16).default('change-me-dev-storage-signing-secret'),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    PDF_CHROMIUM_PATH: z.string().optional().transform((v) => (v ? v : undefined)),
    SMTP_URL: z.string().optional().transform((v) => (v ? v : undefined)),
    MAIL_FROM: z.string().default('Mecaelectric Operaciones <no-reply@mecaelectric.local>'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['S3_ACCESS_KEY'], message: 'Credenciales S3 requeridas con STORAGE_DRIVER=s3' });
    }
    const isProd = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    if (isProd && env.JWT_ACCESS_SECRET.startsWith('change-me')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Configure un secreto real en producción' });
    }
    if (isProd && !env.COOKIE_SECURE) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE debe ser true en producción' });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Configuración inválida:\n${detail}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Solo para pruebas. */
export function resetEnvCache(): void {
  cached = null;
}

export const isProduction = () => ['production', 'staging'].includes(env().NODE_ENV);
