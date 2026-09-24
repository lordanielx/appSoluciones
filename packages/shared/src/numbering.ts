export const APP_TIME_ZONE = 'America/Bogota';

const SEQUENCE_DIGITS = 6;

export const NumberPrefix = {
  WORK_ORDER: 'OT',
  REPORT: 'INF',
} as const;
export type NumberPrefix = (typeof NumberPrefix)[keyof typeof NumberPrefix];

/** Año calendario en la zona horaria de Colombia (evita saltos de año por UTC). */
export function yearInBogota(date: Date = new Date()): number {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, year: 'numeric' }).format(
    date,
  );
  return Number(year);
}

export function formatSequenceNumber(prefix: NumberPrefix, year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('El consecutivo debe ser un entero positivo.');
  }
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export function counterKey(prefix: NumberPrefix, year: number): string {
  return `${prefix}-${year}`;
}

const NUMBER_PATTERN = /^(OT|INF)-(\d{4})-(\d{6,})$/;

export function parseSequenceNumber(value: string) {
  const match = NUMBER_PATTERN.exec(value);
  if (!match) return null;
  return { prefix: match[1] as NumberPrefix, year: Number(match[2]), sequence: Number(match[3]) };
}
