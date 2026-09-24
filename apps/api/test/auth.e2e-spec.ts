import { createTestApp, createUser, login, PASSWORD, type TestContext, auth } from './helpers';

const CSRF = { 'X-Requested-With': 'meca-web' };

function refreshCookie(setCookie: string[] | string | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = list.find((c) => c.startsWith('meca_rt='));
  if (!cookie) throw new Error('No se recibió cookie de refresh');
  return cookie.split(';')[0] as string;
}

describe('Autenticación', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  it('inicia sesión, fija cookie HttpOnly y devuelve permisos', async () => {
    const user = await createUser(ctx.prisma, 'COORDINATOR');
    const res = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('COORDINATOR');
    expect(res.body.user.permissions).toContain('WORK_ORDERS_REVIEW');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('meca_rt='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const me = await ctx.http().get('/api/v1/auth/me').set(auth(res.body.accessToken)).expect(200);
    expect(me.body.email).toBe(user.email);
  });

  it('rechaza credenciales inválidas con mensaje en español y formato común', async () => {
    const user = await createUser(ctx.prisma, 'TECHNICIAN');
    const res = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: 'incorrecta123' }).expect(401);
    expect(res.body).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' });
    await ctx.http().post('/api/v1/auth/login').send({ email: 'noexiste@test.local', password: 'x' }).expect(401);
  });

  it('bloquea temporalmente la cuenta tras 5 intentos fallidos', async () => {
    const user = await createUser(ctx.prisma, 'TECHNICIAN');
    for (let i = 0; i < 5; i++) {
      await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: 'incorrecta123' }).expect(401);
    }
    const res = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(423);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('rota el refresh token y detecta reutilización', async () => {
    const user = await createUser(ctx.prisma, 'ADMIN');
    const loginRes = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    const first = refreshCookie(loginRes.headers['set-cookie']);

    await ctx.http().post('/api/v1/auth/refresh').set('Cookie', first).expect(403); // sin encabezado CSRF

    const r1 = await ctx.http().post('/api/v1/auth/refresh').set('Cookie', first).set(CSRF).expect(200);
    const second = refreshCookie(r1.headers['set-cookie']);
    expect(second).not.toBe(first);

    // Simula el paso de la ventana de gracia y reutiliza el token viejo: se revoca toda la familia.
    await ctx.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    await ctx.http().post('/api/v1/auth/refresh').set('Cookie', first).set(CSRF).expect(401);
    await ctx.http().post('/api/v1/auth/refresh').set('Cookie', second).set(CSRF).expect(401);
    const audit = await ctx.prisma.auditLog.findFirst({ where: { entityId: user.id, action: 'AUTH_REFRESH_REUSE_DETECTED' } });
    expect(audit).not.toBeNull();
  });

  it('cierra sesión revocando el refresh token', async () => {
    const user = await createUser(ctx.prisma, 'ADMIN');
    const loginRes = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    const cookie = refreshCookie(loginRes.headers['set-cookie']);
    await ctx.http().post('/api/v1/auth/logout').set('Cookie', cookie).set(CSRF).expect(204);
    await ctx.http().post('/api/v1/auth/refresh').set('Cookie', cookie).set(CSRF).expect(401);
  });

  it('recupera la contraseña con token de un solo uso', async () => {
    const user = await createUser(ctx.prisma, 'TECHNICIAN');
    await ctx.http().post('/api/v1/auth/forgot-password').send({ email: user.email }).expect(202);
    await ctx.http().post('/api/v1/auth/forgot-password').send({ email: 'nadie@test.local' }).expect(202);
    const mail = ctx.mail.outbox.find((m) => m.to === user.email);
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail?.text ?? '')?.[1] ?? '');
    expect(token.length).toBeGreaterThan(20);

    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'corta' }).expect(400);
    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'NuevaClave2026' }).expect(200);
    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'OtraClave2026' }).expect(400);
    await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: 'NuevaClave2026' }).expect(200);
  });

  it('una cuenta desactivada pierde acceso inmediatamente', async () => {
    const admin = await createUser(ctx.prisma, 'ADMIN');
    const tech = await createUser(ctx.prisma, 'TECHNICIAN');
    const adminToken = await login(ctx, admin.email);
    const techToken = await login(ctx, tech.email);
    await ctx.http().get('/api/v1/auth/me').set(auth(techToken)).expect(200);
    await ctx.http().patch(`/api/v1/users/${tech.id}/status`).set(auth(adminToken)).send({ active: false }).expect(200);
    await ctx.http().get('/api/v1/auth/me').set(auth(techToken)).expect(401);
  });

  it('exige autenticación y no expone detalles internos', async () => {
    const res = await ctx.http().get('/api/v1/work-orders').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Rotación con respuesta perdida', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  it('dentro de la ventana de gracia reemite la sesión en lugar de cerrarla', async () => {
    const user = await createUser(ctx.prisma, 'TECHNICIAN');
    const loginRes = await ctx.http().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    const first = refreshCookie(loginRes.headers['set-cookie']);
    await ctx.http().post('/api/v1/auth/refresh').set('Cookie', first).set(CSRF).expect(200);
    // El navegador nunca recibió la cookie nueva y reintenta con la anterior.
    const retry = await ctx.http().post('/api/v1/auth/refresh').set('Cookie', first).set(CSRF).expect(200);
    expect(retry.body.accessToken).toBeDefined();
  });
});
