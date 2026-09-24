import { auth, createTestApp, createUser, login, unique, uniqueNit, type TestContext } from './helpers';

describe('Administración: usuarios, clientes, equipos, marcas, plantillas', () => {
  let ctx: TestContext;
  let admin: string;
  let coordinator: string;
  let technician: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, (await createUser(ctx.prisma, 'ADMIN')).email);
    coordinator = await login(ctx, (await createUser(ctx.prisma, 'COORDINATOR')).email);
    technician = await login(ctx, (await createUser(ctx.prisma, 'TECHNICIAN')).email);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  it('CA-01: el administrador crea usuarios; el coordinador no', async () => {
    const body = { fullName: 'Pedro Técnico', email: `${unique('pedro')}@test.local`, role: 'TECHNICIAN', password: 'Tecnico2026abc' };
    const res = await ctx.http().post('/api/v1/users').set(auth(admin)).send(body).expect(201);
    expect(res.body).not.toHaveProperty('passwordHash');
    await ctx.http().post('/api/v1/users').set(auth(admin)).send(body).expect(409);
    await ctx.http().post('/api/v1/users').set(auth(coordinator)).send({ ...body, email: 'otro@test.local' }).expect(403);
    const weak = await ctx.http().post('/api/v1/users').set(auth(admin)).send({ ...body, email: 'debil@test.local', password: '123' }).expect(400);
    expect(weak.body.details.fields.password).toBeDefined();
  });

  it('CA-02: registra y busca clientes; NIT único', async () => {
    const nit = uniqueNit();
    const dotted = `${nit.slice(0, 3)}.${nit.slice(3, 6)}.${nit.slice(6)}`;
    const res = await ctx
      .http()
      .post('/api/v1/clients')
      .set(auth(coordinator))
      .send({ legalName: 'Textiles del Valle S.A.S.', nit: dotted, dv: '5', city: 'Cali', department: 'Valle del Cauca' })
      .expect(201);
    expect(res.body.nit).toBe(nit);
    const dup = await ctx.http().post('/api/v1/clients').set(auth(admin)).send({ legalName: 'Otra', nit }).expect(409);
    expect(dup.body.code).toBe('DUPLICATE');

    const search = await ctx.http().get('/api/v1/clients?q=textiles').set(auth(admin)).expect(200);
    expect(search.body.items.some((c: { id: string }) => c.id === res.body.id)).toBe(true);

    await ctx.http().patch(`/api/v1/clients/${res.body.id}`).set(auth(admin)).send({ active: false }).expect(200);
    await ctx.http().post('/api/v1/clients').set(auth(technician)).send({ legalName: 'X', nit: uniqueNit() }).expect(403);
  });

  it('CA-03: registra equipos por cliente con código único por cliente y búsqueda por serial', async () => {
    const client = await ctx.http().post('/api/v1/clients').set(auth(admin)).send({ legalName: 'Cementos Sur S.A.S.', nit: uniqueNit() }).expect(201);
    const eq = { clientId: client.body.id, code: 'cp-01', name: 'Compresor GA30', brand: 'Atlas Copco', model: 'GA30', serial: `SER-${uniqueNit()}` };
    const created = await ctx.http().post('/api/v1/equipment').set(auth(admin)).send(eq).expect(201);
    expect(created.body.code).toBe('CP-01');
    await ctx.http().post('/api/v1/equipment').set(auth(admin)).send(eq).expect(409);
    const bySerial = await ctx.http().get(`/api/v1/equipment?q=${eq.serial}`).set(auth(admin)).expect(200);
    expect(bySerial.body.items[0].id).toBe(created.body.id);
    const ofClient = await ctx.http().get(`/api/v1/clients/${client.body.id}/equipment`).set(auth(admin)).expect(200);
    expect(ofClient.body.total).toBe(1);
  });

  it('gestiona empresas representadas (solo administrador)', async () => {
    const brand = { name: 'Aliado Uno', legalName: 'Aliado Uno S.A.S.', nit: uniqueNit(), primaryColor: '#1F3A5F', secondaryColor: '#1769AA' };
    const res = await ctx.http().post('/api/v1/brand-profiles').set(auth(admin)).send(brand).expect(201);
    await ctx.http().post('/api/v1/brand-profiles').set(auth(coordinator)).send(brand).expect(403);
    await ctx.http().post('/api/v1/brand-profiles').set(auth(admin)).send({ ...brand, primaryColor: 'azul' }).expect(400);
    await ctx.http().patch(`/api/v1/brand-profiles/${res.body.id}`).set(auth(admin)).send({ footerText: 'Pie' }).expect(200);
  });

  it('CA-04: crea plantillas configurables y versiona al cambiar actividades', async () => {
    const st = await ctx.http().post('/api/v1/service-types').set(auth(admin)).send({ code: unique('LUB').slice(0, 20), name: 'Lubricación', requiresEquipment: true }).expect(201);
    const res = await ctx
      .http()
      .post('/api/v1/checklist-templates')
      .set(auth(admin))
      .send({
        name: 'Rutina de lubricación',
        serviceTypeId: st.body.id,
        items: [
          { section: 'Lubricación', label: 'Verificar nivel de aceite', responseType: 'STATUS', required: true, evidenceRequired: true },
          { label: 'Tipo de grasa', responseType: 'SELECT', options: ['EP2', 'Litio'] },
        ],
      })
      .expect(201);
    expect(res.body.version).toBe(1);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].minPhotos).toBe(1);

    const items = res.body.items.slice(0, 1).concat([{ label: 'Temperatura', responseType: 'NUMBER', unit: '°C', maxValue: 90 }]);
    const updated = await ctx.http().patch(`/api/v1/checklist-templates/${res.body.id}`).set(auth(admin)).send({ items }).expect(200);
    expect(updated.body.version).toBe(2);
    expect(updated.body.items.map((i: { label: string }) => i.label)).toEqual(['Verificar nivel de aceite', 'Temperatura']);

    await ctx.http().post('/api/v1/checklist-templates').set(auth(admin)).send({ name: 'Vacía', items: [] }).expect(400);
    await ctx.http().post('/api/v1/checklist-templates').set(auth(coordinator)).send({ name: 'X', items: [{ label: 'a', responseType: 'TEXT' }] }).expect(403);
  });
});
