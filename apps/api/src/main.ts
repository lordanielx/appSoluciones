import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { env, isProduction, loadDotEnv } from './config/env';

async function bootstrap() {
  loadDotEnv();
  const config = env();
  // Importación diferida: los módulos leen la configuración al cargarse.
  const { AppModule } = await import('./app.module');
  const { configureApp, mountSwagger } = await import('./bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  if (!isProduction()) mountSwagger(app);
  await app.listen(config.API_PORT, '0.0.0.0');
  app.get(Logger).log(`API escuchando en :${config.API_PORT} (${config.NODE_ENV})`);
}

void bootstrap();
