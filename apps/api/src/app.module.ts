import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { env } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { EquipmentModule } from './equipment/equipment.module';
import { BrandProfilesModule } from './brand-profiles/brand-profiles.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { ChecklistTemplatesModule } from './checklist-templates/checklist-templates.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { ChecklistExecutionModule } from './checklist-execution/checklist-execution.module';
import { EvidenceModule } from './evidence/evidence.module';
import { SignaturesModule } from './signatures/signatures.module';
import { ReportsModule } from './reports/reports.module';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
import { RequestContextMiddleware } from './common/context/request-context.middleware';

const REQUEST_ID_HEADER = 'x-request-id';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env().LOG_LEVEL,
        transport: env().NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const incoming = req.headers[REQUEST_ID_HEADER];
          const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
          res.setHeader(REQUEST_ID_HEADER, id);
          return id;
        },
        customProps: (req) => ({ userId: (req as IncomingMessage & { user?: { id: string } }).user?.id }),
        // Nunca registrar credenciales, tokens ni cookies.
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.token', '*.refreshToken'],
          censor: '[oculto]',
        },
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, path: req.url.split('?')[0] }),
          res: (res: { statusCode: number }) => ({ status: res.statusCode }),
        },
        customSuccessMessage: (req, res, responseTime) => `${req.method} ${req.url?.split('?')[0]} ${res.statusCode} ${Math.round(responseTime)}ms`,
        autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }] }),
    PrismaModule,
    AuditModule,
    MailModule,
    StorageModule,
    MediaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    EquipmentModule,
    BrandProfilesModule,
    ServiceTypesModule,
    ChecklistTemplatesModule,
    WorkOrdersModule,
    ChecklistExecutionModule,
    EvidenceModule,
    SignaturesModule,
    ReportsModule,
    SyncModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
