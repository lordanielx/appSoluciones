import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express } from 'express';
import { env, isProduction } from './config/env';

export const API_PREFIX = 'api/v1';

/** Configuración HTTP común a main.ts y a las pruebas de integración. */
export function configureApp(app: INestApplication): void {
  const config = env();
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  if (config.TRUST_PROXY > 0) express.set('trust proxy', config.TRUST_PROXY);

  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.use(
    helmet({
      // La API solo sirve JSON, PDF e imágenes: CSP estricta.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: isProduction() ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
    maxAge: 600,
  });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('Mecaelectric Operaciones — API')
    .setDescription(
      'API REST v1 del monolito modular. Errores con formato común `{ code, message, details }`. ' +
        'Autenticación: access token Bearer (15 min) + refresh token en cookie HttpOnly rotativa.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}

export function mountSwagger(app: INestApplication) {
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApi(app), {
    jsonDocumentUrl: `${API_PREFIX}/openapi.json`,
    swaggerOptions: { persistAuthorization: false },
  });
}
