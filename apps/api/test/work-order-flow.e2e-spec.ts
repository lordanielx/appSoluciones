import { randomUUID } from 'node:crypto';
import { auth, createTestApp, createUser, jpeg, login, png, seedCatalog, strokes, uniqueNit, type TestContext } from './helpers';

jest.setTimeout(120_000);

interface Ids {
  client: string;
  equipment: string;
  template: string;
  brand: string;
  serviceType: string;
  generalType: string;
  techA: string;
  techB: string;
}

describe('Flujo completo de orden de trabajo', () => {
  let ctx: TestContext;
  let admin: string;
  let coordinator: string;
  let techA: string;
  let techB: string;
  const ids = {} as Ids;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await login(ctx, (await createUser(ctx.prisma, 'ADMIN', 'Admin')).email);
    coordinator = await login(ctx, (await createUser(ctx.prisma, 'COORDINATOR', 'Coordinador')).email);
    const a = await createUser(ctx.prisma, 'TECHNICIAN', 'Técnico A');
    const b = await createUser(ctx.prisma, 'TECHNICIAN', 'Técnico B');
    ids.techA = a.id;
    ids.techB = b.id;
    techA = await login(ctx, a.email);
    techB = await login(ctx, b.email);
    const catalog = await seedCatalog(ctx.prisma);
    ids.brand = catalog.brand.id;
    ids.serviceType = catalog.serviceType.id;
    ids.generalType = catalog.generalType.id;

    const client = await ctx.http().post('/api/v1/clients').set(auth(admin)).send({ legalName: 'Industrias Andinas S.A.S.', nit: uniqueNit(), city: 'Medellín', address: 'Autopista Sur # 32-150' }).expect(201);
    ids.client = client.body.id;
    const eq = await ctx.http().post('/api/v1/equipment').set(auth(admin)).send({ clientId: ids.client, code: 'MP-001', name: 'Compresor de tornillo', brand: 'Atlas Copco', model: 'GA30', serial: 'API123456' }).expect(201);
    ids.equipment = eq.body.id;
    const tpl = await ctx
      .http()
      .post('/api/v1/checklist-templates')
      .set(auth(admin))
      .send({
        name: 'Preventivo compresor',
        items: [
          { section: 'Lubricación', label: 'Verificar nivel de aceite', responseType: 'STATUS', required: true, evidenceRequired: true },
          { section: 'Operación', label: 'Presión de descarga', responseType: 'NUMBER', unit: 'bar', minValue: 6, maxValue: 8.5, required: true },
          { section: 'Eléctrico', label: 'Estado del motor', responseType: 'STATUS', required: true, evidenceRequired: true },
          { label: 'Comentario adicional', responseType: 'LONG_TEXT', required: false },
        ],
      })
      .expect(201);
    ids.template = tpl.body.id;
  });

  afterAll(async () => {
    await ctx.prisma.$disconnect();
    await ctx.app.close();
  });

  const newOrder = (extra: Record<string, unknown> = {}) => ({
    clientId: ids.client,
    equipmentId: ids.equipment,
    representedCompanyId: ids.brand,
    checklistTemplateId: ids.template,
    serviceTypeId: ids.serviceType,
    title: 'Mantenimiento preventivo trimestral',
    serviceScope: 'Cambio de filtros y verificación general',
    priority: 'HIGH',
    scheduledStart: '2026-09-24T13:00:00.000Z',
    ...extra,
  });

  it('valida reglas de creación (RB-001, RB-002, RB-003)', async () => {
    await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder({ clientId: undefined })).expect(400);
    const noEq = await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder({ equipmentId: null })).expect(422);
    expect(noEq.body.code).toBe('WORK_ORDER_REQUIRES_EQUIPMENT');
    const noTech = await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder({ assignNow: true })).expect(400);
    expect(noTech.body.details.fields.assignedTechnicianId).toBeDefined();
    // Servicio sin equipo específico es válido
    await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder({ equipmentId: null, serviceTypeId: ids.generalType })).expect(201);
    await ctx.http().post('/api/v1/work-orders').set(auth(techA)).send(newOrder()).expect(403);
  });

  it('genera consecutivos legibles OT-AAAA-NNNNNN sin duplicados bajo concurrencia', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => ctx.http().post('/api/v1/work-orders').set(auth(coordinator)).send(newOrder())),
    );
    const numbers = results.map((r) => r.body.number as string);
    expect(new Set(numbers).size).toBe(6);
    for (const n of numbers) expect(n).toMatch(/^OT-\d{4}-\d{6}$/);
  });

  it('recorre el flujo principal con validaciones, correcciones, aprobación y PDF', async () => {
    // Crear (DRAFT) y asignar
    const created = await ctx.http().post('/api/v1/work-orders').set(auth(coordinator)).send(newOrder()).expect(201);
    const id = created.body.id as string;
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.address).toContain('Autopista Sur');

    // El técnico no ve órdenes en borrador
    await ctx.http().get(`/api/v1/work-orders/${id}`).set(auth(techA)).expect(404);

    await ctx.http().post(`/api/v1/work-orders/${id}/accept`).set(auth(techA)).expect(404);
    const assigned = await ctx.http().post(`/api/v1/work-orders/${id}/assign`).set(auth(coordinator)).send({ technicianId: ids.techA }).expect(200);
    expect(assigned.body.status).toBe('ASSIGNED');

    // CA-07 / RB-005: el técnico A ve su orden; el técnico B no
    const list = await ctx.http().get('/api/v1/work-orders').set(auth(techA)).expect(200);
    expect(list.body.items.map((w: { id: string }) => w.id)).toContain(id);
    await ctx.http().get(`/api/v1/work-orders/${id}`).set(auth(techB)).expect(404);
    const listB = await ctx.http().get('/api/v1/work-orders').set(auth(techB)).expect(200);
    expect(listB.body.items.map((w: { id: string }) => w.id)).not.toContain(id);
    await ctx.http().post(`/api/v1/work-orders/${id}/accept`).set(auth(techB)).expect(404);

    // RB-004: no puede iniciar sin aceptar
    const early = await ctx.http().post(`/api/v1/work-orders/${id}/start`).set(auth(techA)).expect(409);
    expect(early.body).toMatchObject({ code: 'WORK_ORDER_INVALID_STATE', message: 'La orden debe estar aceptada antes de iniciar el servicio.' });

    const detail = await ctx.http().get(`/api/v1/work-orders/${id}`).set(auth(techA)).expect(200);
    expect(detail.body.availableActions).toEqual(['ACCEPT', 'REJECT']);
    expect(detail.body.internalNotes).toBeNull();

    await ctx.http().post(`/api/v1/work-orders/${id}/accept`).set(auth(techA)).expect(200);
    // Aún no puede diligenciar checklist sin iniciar
    const checklist = await ctx.http().get(`/api/v1/work-orders/${id}/checklist`).set(auth(techA)).expect(200);
    expect(checklist.body).toHaveLength(4);
    const [oil, pressure, motor] = checklist.body as { id: string; version: number }[];
    await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${oil!.id}`).set(auth(techA)).send({ value: 'GOOD', baseVersion: 1 }).expect(409);

    const started = await ctx.http().post(`/api/v1/work-orders/${id}/start`).set(auth(techA)).expect(200);
    expect(started.body.status).toBe('IN_PROGRESS');

    // Checklist (CA-10)
    const bad = await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${oil!.id}`).set(auth(techA)).send({ value: 'EXCELENTE', baseVersion: 1 }).expect(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
    const r1 = await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${oil!.id}`).set(auth(techA)).send({ value: 'GOOD', observation: 'Nivel en el centro del visor', baseVersion: 1 }).expect(200);
    expect(r1.body.version).toBe(2);
    await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${pressure!.id}`).set(auth(techA)).send({ value: 7.2, baseVersion: 1 }).expect(200);
    await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${motor!.id}`).set(auth(techA)).send({ value: 'CRITICAL', baseVersion: 1 }).expect(200);
    await ctx.http().patch(`/api/v1/work-orders/${id}/technician-notes`).set(auth(techB)).send({ technicianNotes: 'x' }).expect(404);

    // CA-15: no puede finalizar si faltan elementos
    const incomplete = await ctx.http().post(`/api/v1/work-orders/${id}/submit`).set(auth(techA)).expect(422);
    expect(incomplete.body.code).toBe('WORK_ORDER_INCOMPLETE');
    const messages = (incomplete.body.details.issues as { message: string }[]).map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'Falta evidencia en "Verificar nivel de aceite".',
        'Falta evidencia en "Estado del motor".',
        'Falta la observación en "Estado del motor".',
        'Faltan las observaciones y conclusiones técnicas del servicio.',
        'Falta la firma del técnico.',
        'Falta la firma del cliente.',
      ]),
    );

    // Evidencias (CA-11): compresión server-side, idempotencia por id
    const photo = await jpeg(2600, 1800);
    const evId = randomUUID();
    const ev = await ctx
      .http()
      .post(`/api/v1/work-orders/${id}/evidence`)
      .set(auth(techA))
      .field('id', evId)
      .field('checklistResponseId', oil!.id)
      .field('caption', 'Visor de nivel de aceite')
      .field('capturedAt', new Date().toISOString())
      .attach('file', photo, 'foto.jpg')
      .expect(201);
    expect(Math.max(ev.body.width, ev.body.height)).toBeLessThanOrEqual(1920);
    expect(ev.body.thumbnailUrl).toContain('/api/v1/files/');
    const again = await ctx.http().post(`/api/v1/work-orders/${id}/evidence`).set(auth(techA)).field('id', evId).field('checklistResponseId', oil!.id).attach('file', photo, 'foto.jpg').expect(201);
    expect(again.body.id).toBe(evId);
    expect(await ctx.prisma.evidence.count({ where: { workOrderId: id } })).toBe(1);

    // Archivo servido mediante URL firmada; una firma alterada se rechaza
    const file = await ctx.http().get(ev.body.thumbnailUrl).expect(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    await ctx.http().get(ev.body.thumbnailUrl.replace(/sig=[^&]+/, 'sig=manipulada')).expect(403);

    // MIME real validado (no por extensión)
    await ctx.http().post(`/api/v1/work-orders/${id}/evidence`).set(auth(techA)).field('id', randomUUID()).attach('file', Buffer.from('<svg onload=alert(1)>'), 'x.jpg').expect(400);

    // Evidencia retirada lógicamente no cuenta
    const tmpId = randomUUID();
    await ctx.http().post(`/api/v1/work-orders/${id}/evidence`).set(auth(techA)).field('id', tmpId).field('checklistResponseId', motor!.id).attach('file', photo, 'foto.jpg').expect(201);
    await ctx.http().delete(`/api/v1/work-orders/${id}/evidence/${tmpId}`).set(auth(techA)).expect(204);
    expect((await ctx.prisma.evidence.findUnique({ where: { id: tmpId } }))?.deletedAt).not.toBeNull();

    await ctx.http().post(`/api/v1/work-orders/${id}/evidence`).set(auth(techA)).field('id', randomUUID()).field('checklistResponseId', motor!.id).field('caption', 'Carcasa con recalentamiento').attach('file', photo, 'motor.jpg').expect(201);
    await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${motor!.id}`).set(auth(techA)).send({ value: 'CRITICAL', observation: 'Rodamiento lado acople con ruido; programar cambio.', baseVersion: 2 }).expect(200);
    await ctx.http().patch(`/api/v1/work-orders/${id}/technician-notes`).set(auth(techA)).send({ technicianNotes: 'Equipo operativo. Se recomienda cambio de rodamientos del motor en la próxima parada.' }).expect(200);

    // Firmas (CA-14)
    const sigPng = await png();
    const clientNoConsent = await ctx.http().post(`/api/v1/work-orders/${id}/signatures`).set(auth(techA))
      .field('id', randomUUID()).field('signatureType', 'CLIENT').field('signerName', 'Luisa Ortiz').field('signedAt', new Date().toISOString())
      .field('consentAccepted', 'false').field('strokes', strokes).attach('file', sigPng, 'firma.png').expect(400);
    expect(clientNoConsent.body.details.fields.consentAccepted).toBeDefined();
    await ctx.http().post(`/api/v1/work-orders/${id}/signatures`).set(auth(techA))
      .field('id', randomUUID()).field('signatureType', 'TECHNICIAN').field('signerName', 'Técnico A').field('signedAt', new Date().toISOString())
      .field('consentAccepted', 'true').field('strokes', JSON.stringify({ width: 600, height: 240, strokes: [] })).attach('file', sigPng, 'firma.png').expect(400);
    await ctx.http().post(`/api/v1/work-orders/${id}/signatures`).set(auth(techA))
      .field('id', randomUUID()).field('signatureType', 'TECHNICIAN').field('signerName', 'Técnico A').field('signedAt', new Date().toISOString())
      .field('consentAccepted', 'true').field('strokes', strokes).attach('file', sigPng, 'firma.png').expect(201);
    const clientSig = await ctx.http().post(`/api/v1/work-orders/${id}/signatures`).set(auth(techA))
      .field('id', randomUUID()).field('signatureType', 'CLIENT').field('signerName', 'Luisa Ortiz').field('signerRole', 'Jefe de mantenimiento')
      .field('signedAt', new Date().toISOString()).field('consentAccepted', 'true').field('strokes', strokes).attach('file', sigPng, 'firma.png').expect(201);
    const svg = await ctx.http().get(clientSig.body.svgUrl).expect(200);
    expect(svg.headers['content-type']).toBe('image/svg+xml');

    // Envío a revisión
    const submitted = await ctx.http().post(`/api/v1/work-orders/${id}/submit`).set(auth(techA)).expect(200);
    expect(submitted.body.status).toBe('PENDING_REVIEW');
    // Tras enviar, el técnico ya no puede editar
    await ctx.http().patch(`/api/v1/work-orders/${id}/checklist/responses/${pressure!.id}`).set(auth(techA)).send({ value: 7.5, baseVersion: 2 }).expect(409);
    // El técnico no puede aprobar
    await ctx.http().post(`/api/v1/work-orders/${id}/approve`).set(auth(techA)).expect(403);

    // CA-17: solicitud de corrección exige comentario
    await ctx.http().post(`/api/v1/work-orders/${id}/request-changes`).set(auth(coordinator)).send({ comment: '' }).expect(400);
    const changes = await ctx.http().post(`/api/v1/work-orders/${id}/request-changes`).set(auth(coordinator)).send({ comment: 'Agregar fotografía de placa del motor.' }).expect(200);
    expect(changes.body.status).toBe('CHANGES_REQUESTED');
    const techView = await ctx.http().get(`/api/v1/work-orders/${id}`).set(auth(techA)).expect(200);
    expect(techView.body.changesRequestedComment).toBe('Agregar fotografía de placa del motor.');
    expect(techView.body.availableActions).toEqual(expect.arrayContaining(['START', 'SUBMIT']));

    await ctx.http().post(`/api/v1/work-orders/${id}/evidence`).set(auth(techA)).field('id', randomUUID()).field('checklistResponseId', motor!.id).field('caption', 'Placa del motor').attach('file', photo, 'placa.jpg').expect(201);
    await ctx.http().post(`/api/v1/work-orders/${id}/submit`).set(auth(techA)).expect(200);

    // Vista previa (no almacenada)
    const preview = await ctx.http().get(`/api/v1/work-orders/${id}/report-preview`).set(auth(coordinator)).expect(200);
    expect(preview.headers['content-type']).toBe('application/pdf');
    expect(await ctx.prisma.report.count({ where: { workOrderId: id } })).toBe(0);

    // CA-18 / CA-19: aprobación genera PDF almacenado
    const approved = await ctx.http().post(`/api/v1/work-orders/${id}/approve`).set(auth(coordinator)).expect(200);
    expect(approved.body.workOrder.status).toBe('APPROVED');
    expect(approved.body.report.reportNumber).toMatch(/^INF-\d{4}-\d{6}$/);
    expect(approved.body.report.version).toBe(1);
    const pdf = await ctx.http().get(`/api/v1/reports/${approved.body.report.id}/pdf`).set(auth(techA)).buffer(true).expect(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await ctx.http().get(`/api/v1/reports/${approved.body.report.id}/pdf`).set(auth(techB)).expect(404);

    // RB-014: no se modifica en silencio
    const locked = await ctx.http().patch(`/api/v1/work-orders/${id}`).set(auth(admin)).send({ title: 'Cambio', version: approved.body.workOrder.version }).expect(409);
    expect(locked.body.code).toBe('WORK_ORDER_NOT_EDITABLE');
    const v2 = await ctx.http().post(`/api/v1/work-orders/${id}/reports/generate`).set(auth(admin)).expect(201);
    expect(v2.body.version).toBe(2);
    expect(v2.body.reportNumber).toBe(approved.body.report.reportNumber);
    const versions = await ctx.http().get(`/api/v1/work-orders/${id}/reports`).set(auth(admin)).expect(200);
    expect(versions.body.map((r: { version: number; status: string }) => [r.version, r.status])).toEqual([
      [2, 'APPROVED'],
      [1, 'SUPERSEDED'],
    ]);

    const closed = await ctx.http().post(`/api/v1/work-orders/${id}/close`).set(auth(coordinator)).expect(200);
    expect(closed.body.status).toBe('CLOSED');
    await ctx.http().post(`/api/v1/work-orders/${id}/cancel`).set(auth(admin)).send({ reason: 'Intento tardío' }).expect(409);

    // CA-21 / CA-22: historial y auditoría
    const statuses = await ctx.http().get(`/api/v1/work-orders/${id}/status-history`).set(auth(admin)).expect(200);
    expect(statuses.body.map((s: { toStatus: string }) => s.toStatus)).toEqual([
      'DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PENDING_REVIEW', 'APPROVED', 'CLOSED',
    ]);
    const history = await ctx.http().get(`/api/v1/work-orders/${id}/history`).set(auth(admin)).expect(200);
    const actions = new Set(history.body.map((h: { action: string }) => h.action));
    for (const a of ['WORK_ORDER_CREATED', 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_ACCEPTED', 'WORK_ORDER_STARTED', 'CHECKLIST_UPDATED', 'EVIDENCE_ADDED', 'SIGNATURE_ADDED', 'WORK_ORDER_SUBMITTED', 'CHANGES_REQUESTED', 'REPORT_GENERATED', 'WORK_ORDER_APPROVED', 'WORK_ORDER_CLOSED']) {
      expect(actions).toContain(a);
    }
    const audit = await ctx.prisma.auditLog.findFirst({ where: { workOrderId: id, action: 'WORK_ORDER_APPROVED' } });
    expect(audit?.actorId).toBeDefined();
    expect(audit?.requestId).toBeTruthy();
  });

  it('permite rechazo con motivo, reasignación y excepción de firma del cliente', async () => {
    const created = await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder({ assignNow: true, assignedTechnicianId: ids.techA })).expect(201);
    const id = created.body.id as string;
    expect(created.body.status).toBe('ASSIGNED');
    await ctx.http().post(`/api/v1/work-orders/${id}/reject`).set(auth(techA)).send({ reason: 'no' }).expect(400);
    const rejected = await ctx.http().post(`/api/v1/work-orders/${id}/reject`).set(auth(techA)).send({ reason: 'Estoy asignado a otra planta ese día.' }).expect(200);
    expect(rejected.body.status).toBe('REJECTED');
    const reassigned = await ctx.http().post(`/api/v1/work-orders/${id}/assign`).set(auth(coordinator)).send({ technicianId: ids.techB }).expect(200);
    expect(reassigned.body.technician.id).toBe(ids.techB);
    await ctx.http().get(`/api/v1/work-orders/${id}`).set(auth(techA)).expect(404);

    await ctx.http().post(`/api/v1/work-orders/${id}/client-signature-waiver`).set(auth(techB)).send({ reason: 'El cliente no está' }).expect(403);
    const waived = await ctx.http().post(`/api/v1/work-orders/${id}/client-signature-waiver`).set(auth(coordinator)).send({ reason: 'Planta cerrada; cliente autoriza por correo.' }).expect(200);
    expect(waived.body.clientSignatureWaived).toBe(true);
  });

  it('protege la edición con concurrencia optimista', async () => {
    const created = await ctx.http().post('/api/v1/work-orders').set(auth(admin)).send(newOrder()).expect(201);
    const id = created.body.id as string;
    await ctx.http().patch(`/api/v1/work-orders/${id}`).set(auth(admin)).send({ title: 'Primera edición', version: created.body.version }).expect(200);
    const conflict = await ctx.http().patch(`/api/v1/work-orders/${id}`).set(auth(coordinator)).send({ title: 'Edición vieja', version: created.body.version }).expect(409);
    expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT', message: 'Esta orden fue modificada desde otro dispositivo.' });
  });

  it('dashboard operativo con contadores', async () => {
    const res = await ctx.http().get('/api/v1/dashboard').set(auth(coordinator)).expect(200);
    expect(res.body.counters.open).toBeGreaterThan(0);
    expect(res.body.recentWorkOrders.length).toBeGreaterThan(0);
    expect(res.body.recentActivity.length).toBeGreaterThan(0);
    await ctx.http().get('/api/v1/dashboard').set(auth(techA)).expect(403);
  });
});
