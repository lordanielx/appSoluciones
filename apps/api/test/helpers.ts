import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaClient, type Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { MailService } from '../src/mail/mail.service';

export const PASSWORD = 'Prueba2026segura';

export interface TestContext {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  prisma: PrismaClient;
  mail: MailService;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  const server = app.getHttpServer() as App;
  return { app, http: () => request(server), prisma: new PrismaClient(), mail: app.get(MailService) };
}

let seq = 0;
export const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function createUser(prisma: PrismaClient, role: Role, name: string = role) {
  const email = `${unique(role.toLowerCase())}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      fullName: `Usuario ${name}`,
      role,
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
    },
  });
  return user;
}

export async function login(ctx: TestContext, email: string): Promise<string> {
  const res = await ctx.http().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

export async function seedCatalog(prisma: PrismaClient) {
  const brand = await prisma.brandProfile.create({
    data: {
      name: unique('Marca '),
      legalName: 'MECAELECTRIC S.A.S.',
      nit: '901234567',
      primaryColor: '#0B1F33',
      secondaryColor: '#E85D04',
      isDefault: false,
    },
  });
  const serviceType = await prisma.serviceType.create({
    data: { code: unique('MP').toUpperCase().slice(0, 20), name: 'Mantenimiento preventivo', requiresEquipment: true },
  });
  const generalType = await prisma.serviceType.create({
    data: { code: unique('GEN').toUpperCase().slice(0, 20), name: 'Visita general', requiresEquipment: false },
  });
  return { brand, serviceType, generalType };
}

export async function jpeg(width = 2400, height = 1600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 140 } } })
    .jpeg()
    .toBuffer();
}

export async function png(width = 600, height = 240): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .png()
    .toBuffer();
}

export const strokes = JSON.stringify({
  width: 600,
  height: 240,
  strokes: [
    [[20, 120], [60, 80], [100, 140], [140, 90], [180, 130]],
    [[220, 100], [260, 150], [300, 90], [340, 140]],
  ],
});

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** NIT numérico aleatorio (único por ejecución). */
export const uniqueNit = () => String(800_000_000 + Math.floor(Math.random() * 199_999_999));
