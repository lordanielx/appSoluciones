import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const API = 'http://localhost:3100/api/v1';
export const PASSWORD = 'Mecaelectric2026';
export const ADMIN = 'admin@mecaelectric.local';
export const COORDINATOR = 'coordinador@mecaelectric.local';
export const TECHNICIAN = 'tecnico@mecaelectric.local';

export const uniqueNit = () => String(800_000_000 + Math.floor(Math.random() * 199_999_999));

/** Cliente REST mínimo para preparar y verificar datos directamente contra la API. */
export async function apiAs(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  const { accessToken } = (await res.json()) as { accessToken: string };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
  return { get: <T>(p: string) => call<T>('GET', p), post: <T>(p: string, b?: unknown) => call<T>('POST', p, b ?? {}) };
}

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'INGRESAR' }).click();
}

export async function mobileContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
}

/** Espera a que el service worker controle la página (necesario para trabajar sin conexión). */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }
}

/** Dibuja una firma sobre el lienzo con trazos reales de puntero. */
export async function drawSignature(page: Page, canvasLabel: RegExp) {
  const canvas = page.getByRole('img', { name: canvasLabel });
  // Centrar el lienzo: los encabezados fijos no deben cubrir el área de firma.
  await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Lienzo de firma no visible');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 30, y);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(box.x + 30 + i * 10, y + Math.sin(i / 2) * 30, { steps: 2 });
  }
  await page.mouse.up();
}

export interface Catalog {
  clientId: string;
  equipmentId: string;
  templateId: string;
  serviceTypeId: string;
  brandId: string;
  technicianId: string;
}

/** Plantilla corta dedicada a E2E (evidencia obligatoria, medición con rango, sí/no). */
export async function prepareCatalog(): Promise<Catalog> {
  const admin = await apiAs(ADMIN);
  const client = await admin.post<{ id: string }>('/clients', { legalName: `Planta E2E ${Date.now()}`, nit: uniqueNit(), city: 'Medellín', address: 'Calle 10 # 20-30', contactName: 'Laura Rincón' });
  const equipment = await admin.post<{ id: string }>('/equipment', { clientId: client.id, code: 'E2E-01', name: 'Compresor de tornillo', brand: 'Atlas Copco', model: 'GA30', serial: `SN-${Date.now()}` });
  const types = await admin.get<{ id: string; code: string }[]>('/service-types');
  const serviceTypeId = types.find((t) => t.code === 'MP')!.id;
  const template = await admin.post<{ id: string }>('/checklist-templates', {
    name: `Rutina E2E ${Date.now()}`,
    serviceTypeId,
    items: [
      { section: 'Lubricación', label: 'Verificar nivel de aceite', responseType: 'STATUS', required: true, evidenceRequired: true, minPhotos: 1 },
      { section: 'Operación', label: 'Presión de descarga', responseType: 'NUMBER', unit: 'bar', minValue: 6, maxValue: 8.5, required: true },
      { section: 'Seguridad', label: 'Guardas de protección instaladas', responseType: 'BOOLEAN', required: true },
    ],
  });
  const brands = await admin.get<{ id: string; isDefault: boolean }[]>('/brand-profiles');
  const techs = await admin.get<{ id: string; fullName: string }[]>('/users/technicians');
  return {
    clientId: client.id,
    equipmentId: equipment.id,
    templateId: template.id,
    serviceTypeId,
    brandId: brands.find((b) => b.isDefault)!.id,
    technicianId: techs.find((t) => t.fullName === 'Juan Pérez')!.id,
  };
}
