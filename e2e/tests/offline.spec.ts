import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { COORDINATOR, TECHNICIAN, apiAs, drawSignature, login, mobileContext, prepareCatalog, waitForServiceWorker } from './support';

const PHOTO = resolve(__dirname, '../fixtures/placa.jpg');

/**
 * Escenario offline (§60): descargar OT con conexión, trabajar sin señal, ver cambios pendientes,
 * recuperar conexión, sincronizar y validar en el backend sin operaciones duplicadas.
 */
test('el técnico completa el servicio sin conexión y sincroniza sin duplicados', async ({ browser }) => {
  const catalog = await prepareCatalog();
  const coordinator = await apiAs(COORDINATOR);
  const wo = await coordinator.post<{ id: string; number: string }>('/work-orders', {
    clientId: catalog.clientId,
    equipmentId: catalog.equipmentId,
    serviceTypeId: catalog.serviceTypeId,
    checklistTemplateId: catalog.templateId,
    representedCompanyId: catalog.brandId,
    title: 'Preventivo en zona sin cobertura',
    priority: 'HIGH',
    scheduledStart: new Date().toISOString(),
    assignNow: true,
    assignedTechnicianId: catalog.technicianId,
  });

  // 1. Descargar la OT con conexión
  const ctx = await mobileContext(browser);
  const page = await ctx.newPage();
  await login(page, TECHNICIAN);
  await expect(page.getByRole('link', { name: new RegExp(wo.number) })).toBeVisible();
  await waitForServiceWorker(page);
  await expect(page.getByRole('link', { name: new RegExp(wo.number) })).toBeVisible();

  // 2. Activar modo offline
  await ctx.setOffline(true);
  await expect(page.getByRole('link', { name: /Sin conexión/ })).toBeVisible();

  // 3. Abrir la OT y 4. completar checklist
  await page.getByRole('link', { name: new RegExp(wo.number) }).click();
  await page.getByRole('button', { name: 'ACEPTAR SERVICIO' }).click();
  await page.getByRole('button', { name: 'INICIAR SERVICIO' }).click();
  await page.getByRole('radio', { name: 'Regular' }).click();
  // 5. Capturar evidencia
  await page.getByLabel('Seleccionar fotografías').setInputFiles(PHOTO);
  await expect(page.getByText('Pendiente').first()).toBeVisible();
  await page.getByRole('button', { name: /Guardar y continuar/ }).click();
  await page.getByRole('textbox').first().fill('7,9');
  await page.getByRole('button', { name: /Guardar y continuar/ }).click();
  await page.getByRole('radio', { name: 'Sí' }).click();
  await page.getByRole('button', { name: /Continuar a evidencias/ }).click();
  await page.getByRole('button', { name: /Continuar a firmas/ }).click();

  // 6. Firmar (técnico y cliente)
  await drawSignature(page, /Firma del técnico/);
  await page.getByRole('button', { name: 'Guardar firma' }).first().click();
  await expect(page.getByText('Firma guardada.').first()).toBeVisible();
  await drawSignature(page, /Firma del responsable del cliente/);
  await page.getByLabel(/Firma de conformidad/).check();
  await page.getByRole('button', { name: 'Guardar firma' }).click();
  await page.getByRole('button', { name: /Continuar al resumen/ }).click();

  // 7. Guardar y enviar (queda en cola)
  await page.getByLabel(/Observaciones y conclusiones técnicas/).fill('Servicio ejecutado sin cobertura celular. Filtro con saturación moderada.');
  await page.getByLabel(/Observaciones y conclusiones técnicas/).blur();
  await page.getByRole('button', { name: 'ENVIAR A REVISIÓN' }).click();
  await expect(page.getByText(/el envío quedará en cola/)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();

  // 8. Estado "pendiente de sincronización" visible
  const indicator = page.getByRole('link', { name: /Sin conexión · \d+ pendientes?/ });
  await expect(indicator).toBeVisible();

  // Nada llegó al servidor todavía
  const before = await coordinator.get<{ status: string }>(`/work-orders/${wo.id}`);
  expect(before.status).toBe('ASSIGNED');

  // Recargar la app sin señal: los datos siguen en el dispositivo
  await page.reload();
  await expect(page.getByText('Servicio enviado a revisión').first()).toBeVisible();

  // 9. Recuperar conexión y 10. sincronizar
  await ctx.setOffline(false);
  await expect(page.getByRole('link', { name: 'Sincronizado' })).toBeVisible({ timeout: 45_000 });

  // 11. Validar backend y 12. sin duplicados
  const after = await coordinator.get<{ status: string; technicianNotes: string }>(`/work-orders/${wo.id}`);
  expect(after.status).toBe('PENDING_REVIEW');
  expect(after.technicianNotes).toContain('sin cobertura');
  const bundle = await coordinator.get<{ evidence: unknown[]; signatures: unknown[]; checklist: { value: unknown }[] }>(`/work-orders/${wo.id}/bundle`);
  expect(bundle.evidence).toHaveLength(1);
  expect(bundle.signatures).toHaveLength(2);
  expect(bundle.checklist.map((c) => c.value)).toEqual(['FAIR', 7.9, true]);
  const history = await coordinator.get<{ action: string }[]>(`/work-orders/${wo.id}/history`);
  const count = (a: string) => history.filter((h) => h.action === a).length;
  expect(count('WORK_ORDER_ACCEPTED')).toBe(1);
  expect(count('WORK_ORDER_STARTED')).toBe(1);
  expect(count('WORK_ORDER_SUBMITTED')).toBe(1);
  expect(count('EVIDENCE_ADDED')).toBe(1);
  expect(count('SIGNATURE_ADDED')).toBe(2);

  await ctx.close();
});
