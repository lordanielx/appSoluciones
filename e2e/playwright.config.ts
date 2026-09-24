import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * E2E contra el build de producción de la PWA (service worker real) y la API real.
 * Base de datos dedicada: mecaelectric_e2e (migraciones + seed se aplican en global-setup).
 */
const root = resolve(__dirname, '..');
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://meca:meca@localhost:5432/mecaelectric_e2e?schema=public';
const API_PORT = 3100;
const WEB_PORT = 4173;

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node -r @swc-node/register src/main.ts',
      cwd: resolve(root, 'apps/api'),
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        API_PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_ACCESS_SECRET: 'e2e-access-secret-with-at-least-32-characters',
        STORAGE_DRIVER: 'local',
        LOCAL_STORAGE_DIR: resolve(root, 'test-results/e2e-storage'),
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
        AUTH_RATE_LIMIT_PER_MINUTE: '200',
      },
    },
    {
      command: `pnpm --filter @meca/web build && pnpm --filter @meca/web exec vite preview --port ${WEB_PORT} --strictPort`,
      cwd: root,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NODE_ENV: 'production', VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
