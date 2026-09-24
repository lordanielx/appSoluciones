import { expect, test } from '@playwright/test';
import { ADMIN, TECHNICIAN, apiAs, drawSignature, login, mobileContext, prepareCatalog, uniqueNit } from './support';
import { resolve } from 'node:path';

const PHOTO = resolve(__dirname, '../fixtures/placa.jpg');

/**
 * Escenario principal del RFP (§59, §66): administración crea cliente, equipo y OT y la asigna;
 * el técnico acepta, ejecuta checklist, adjunta fotos, firma, captura firma del cliente y envía;
 * la administración revisa y aprueba; el sistema genera y almacena el PDF con trazabilidad.
 */
test('flujo completo administrador → técnico → aprobación → PDF', async ({ browser }) => {
  const catalog = await prepareCatalog();
  const templates = await (await apiAs(ADMIN)).get<{ items: { id: string; name: string }[] }>(`/checklist-templates?pageSize=100`);
  const templateName = templates.items.find((t) => t.id === catalog.templateId)!.name;
  const clientName = `Industrias E2E ${Date.now()} S.A.S.`;

  // ---------------- Administrador (escritorio)
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN);
  await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Crear cliente
  await admin.goto('/clients/new');
  await admin.getByLabel('Razón social').fill(clientName);
  await admin.getByLabel('NIT').fill(uniqueNit());
  await admin.getByLabel('Contacto principal').fill('Laura Rincón');
  await admin.getByLabel('Dirección').fill('Carrera 43A # 1-50');
  await admin.getByLabel('Ciudad').fill('Medellín');
  await admin.getByRole('button', { name: 'Registrar cliente' }).click();
  await expect(admin.getByText('Cliente registrado correctamente.')).toBeVisible();
  await expect(admin.getByRole('heading', { name: clientName })).toBeVisible();

  // Registrar equipo desde el cliente
  await admin.getByRole('button', { name: 'Registrar equipo' }).click();
  await admin.getByLabel('Código interno').fill('MP-900');
  await admin.getByLabel(/^Nombre/).fill('Compresor de tornillo GA30');
  await admin.getByLabel('Marca').fill('Atlas Copco');
  await admin.getByLabel('Serial').fill(`API-${Date.now()}`);
  await admin.getByRole('button', { name: /Registrar equipo|Guardar/ }).click();
  await expect(admin.getByText(/Equipo registrado/)).toBeVisible();

  // Crear OT con el asistente y asignarla
  await admin.goto('/work-orders/new');
  await admin.getByPlaceholder('Buscar cliente por nombre o NIT').fill('Industrias E2E');
  await admin.getByText(clientName).click();
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByText('Compresor de tornillo GA30').click();
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByText('Mantenimiento preventivo', { exact: false }).first().click();
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByText(templateName).click();
  await admin.getByRole('button', { name: 'Continuar' }).click();
  const now = new Date(Date.now() - 5 * 3600_000 + 30 * 60_000).toISOString().slice(0, 16);
  await admin.getByLabel('Inicio programado').fill(now);
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByText('Juan Pérez').click();
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByRole('button', { name: 'Continuar' }).click(); // empresa por defecto
  await admin.getByLabel('Alcance del servicio').fill('Cambio de filtros y verificación de parámetros.');
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByRole('button', { name: 'Crear y asignar' }).click();
  await expect(admin.getByText(/creada y asignada correctamente/)).toBeVisible();
  await expect(admin.getByText('Asignada', { exact: true }).first()).toBeVisible();
  const workOrderId = admin.url().split('/work-orders/')[1]!;
  const number = (await admin.locator('h1').innerText()).trim();
  expect(number).toMatch(/^OT-\d{4}-\d{6}$/);

  // ---------------- Técnico (móvil)
  const techCtx = await mobileContext(browser);
  const tech = await techCtx.newPage();
  await login(tech, TECHNICIAN);
  await expect(tech.getByRole('heading', { name: /Juan/ })).toBeVisible();
  await tech.getByRole('link', { name: new RegExp(number) }).click();
  await tech.getByRole('button', { name: 'ACEPTAR SERVICIO' }).click();
  await tech.getByRole('button', { name: 'INICIAR SERVICIO' }).click();
  await expect(tech.getByText('1 de 3 actividades')).toBeVisible();

  // 01 — estado + evidencia obligatoria
  await tech.getByRole('radio', { name: 'Bueno' }).click();
  await tech.getByLabel('Seleccionar fotografías').setInputFiles(PHOTO);
  await expect(tech.getByText('Fotos: 1')).toBeVisible();
  await tech.getByRole('button', { name: /Guardar y continuar/ }).click();
  // 02 — medición
  await expect(tech.getByText('2 de 3 actividades')).toBeVisible();
  await tech.getByRole('textbox').first().fill('7,2');
  await tech.getByRole('button', { name: /Guardar y continuar/ }).click();
  // 03 — sí/no
  await tech.getByRole('radio', { name: 'Sí' }).click();
  await tech.getByRole('button', { name: /Continuar a evidencias/ }).click();
  await tech.getByRole('button', { name: /Continuar a firmas/ }).click();

  // Firmas
  await drawSignature(tech, /Firma del técnico/);
  await tech.getByRole('button', { name: 'Guardar firma' }).first().click();
  await expect(tech.getByText('Firma guardada.').first()).toBeVisible();
  await tech.getByLabel('Cargo').last().fill('Jefe de mantenimiento');
  await drawSignature(tech, /Firma del responsable del cliente/);
  await tech.getByLabel(/Firma de conformidad/).check();
  await tech.getByRole('button', { name: 'Guardar firma' }).click();
  await tech.getByRole('button', { name: /Continuar al resumen/ }).click();

  // Resumen y envío
  await tech.getByLabel(/Observaciones y conclusiones técnicas/).fill('Equipo operando dentro de parámetros. Se reemplazó filtro de aire.');
  await tech.getByLabel(/Observaciones y conclusiones técnicas/).blur();
  await expect(tech.getByText('No es posible enviar el servicio.')).toBeHidden();
  await tech.getByRole('button', { name: 'ENVIAR A REVISIÓN' }).click();
  await tech.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(tech.getByText('Servicio enviado a revisión').first()).toBeVisible();
  await expect(tech.getByRole('link', { name: 'Sincronizado' })).toBeVisible({ timeout: 30_000 });

  // ---------------- Revisión y aprobación
  await expect.poll(async () => (await (await apiAs(ADMIN)).get<{ status: string }>(`/work-orders/${workOrderId}`)).status).toBe('PENDING_REVIEW');
  await admin.goto(`/work-orders/${workOrderId}/review`);
  await expect(admin.getByText('Verificar nivel de aceite').first()).toBeVisible();
  await expect(admin.getByAltText(/Firma de/).first()).toBeVisible();
  await admin.getByRole('button', { name: 'APROBAR INFORME' }).click();
  await admin.getByRole('button', { name: 'Aprobar y generar PDF' }).click();
  await expect(admin.getByText(/aprobado y almacenado/)).toBeVisible({ timeout: 60_000 });
  await expect(admin.getByText(/INF-\d{4}-\d{6}/).first()).toBeVisible();

  // ---------------- Verificación en backend: PDF almacenado y trazabilidad
  const api = await apiAs(ADMIN);
  const reports = await api.get<{ id: string; version: number; status: string }[]>(`/work-orders/${workOrderId}/reports`);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ version: 1, status: 'APPROVED' });
  const statuses = await api.get<{ toStatus: string }[]>(`/work-orders/${workOrderId}/status-history`);
  expect(statuses.map((s) => s.toStatus)).toEqual(['DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED']);
  const history = await api.get<{ action: string }[]>(`/work-orders/${workOrderId}/history`);
  expect(history.filter((h) => h.action === 'EVIDENCE_ADDED')).toHaveLength(1);
  expect(history.filter((h) => h.action === 'SIGNATURE_ADDED')).toHaveLength(2);

  await adminCtx.close();
  await techCtx.close();
});
