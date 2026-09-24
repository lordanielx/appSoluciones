import { APP_TIME_ZONE } from '@meca/shared';

const locale = 'es-CO';
const dateTime = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const date = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
const shortDateTime = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const time = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const longDay = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

const parse = (v: string | Date | null | undefined) => (v ? (typeof v === 'string' ? new Date(v) : v) : null);

export const fmtDateTime = (v: string | Date | null | undefined) => {
  const d = parse(v);
  return d ? dateTime.format(d) : '—';
};
export const fmtDate = (v: string | Date | null | undefined) => {
  const d = parse(v);
  return d ? date.format(d) : '—';
};
export const fmtShort = (v: string | Date | null | undefined) => {
  const d = parse(v);
  return d ? shortDateTime.format(d) : '—';
};
export const fmtTime = (v: string | Date | null | undefined) => {
  const d = parse(v);
  return d ? time.format(d) : '—';
};
/** "Miércoles, 23 de septiembre de 2026" */
export const fmtLongDay = (v: Date = new Date()) => {
  const s = longDay.format(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** AAAA-MM-DD en hora de Bogotá (agrupar "hoy"). */
export const bogotaDayKey = (v: string | Date) => dayKey.format(parse(v) as Date);

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', hour12: false }).format(now));
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Valor de <input type="datetime-local"> interpretado en hora de Bogotá (UTC-5 fijo). */
export function toBogotaInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return d.toISOString().slice(0, 16);
}
export function fromBogotaInput(v: string): string | null {
  if (!v) return null;
  return new Date(`${v}:00-05:00`).toISOString();
}

export const nitWithDv = (nit: string, dv: string | null) => (dv ? `${nit}-${dv}` : nit);
