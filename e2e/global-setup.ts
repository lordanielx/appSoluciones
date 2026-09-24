import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { E2E_DATABASE_URL } from './playwright.config';

/** Migraciones (no destructivas) + datos demostrativos idempotentes. */
export default function globalSetup() {
  const cwd = resolve(__dirname, '../apps/api');
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, NODE_ENV: 'development' };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd, env, stdio: 'inherit' });
}
