import { execSync } from 'node:child_process';

/**
 * Aplica las migraciones reales sobre la base de pruebas (no destructivo).
 * Las pruebas generan datos únicos por ejecución, por lo que no requieren vaciar la base.
 */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://meca:meca@localhost:5432/mecaelectric_test?schema=public';
  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
