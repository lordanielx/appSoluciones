/**
 * Exporta la especificación OpenAPI a docs/openapi.json sin levantar el servidor.
 * Uso: pnpm --filter @meca/api openapi
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { loadDotEnv } from '../src/config/env';

async function main() {
  loadDotEnv();
  const { AppModule } = await import('../src/app.module');
  const { buildOpenApi, API_PREFIX } = await import('../src/bootstrap');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);
  const doc = buildOpenApi(app);
  const out = resolve(__dirname, '../../../docs/openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2));
  await app.close();
  console.warn(`OpenAPI exportado: ${out} (${Object.keys(doc.paths).length} rutas)`);
}

void main();
