import { describe, expect, it } from 'vitest';
import { formatSequenceNumber, NumberPrefix, parseSequenceNumber, yearInBogota } from '../src';

describe('numeración legible', () => {
  it('formatea OT e informes con 6 dígitos', () => {
    expect(formatSequenceNumber(NumberPrefix.WORK_ORDER, 2026, 1)).toBe('OT-2026-000001');
    expect(formatSequenceNumber(NumberPrefix.REPORT, 2026, 121)).toBe('INF-2026-000121');
    expect(formatSequenceNumber(NumberPrefix.WORK_ORDER, 2026, 1234567)).toBe('OT-2026-1234567');
  });

  it('rechaza consecutivos inválidos', () => {
    expect(() => formatSequenceNumber(NumberPrefix.WORK_ORDER, 2026, 0)).toThrow();
    expect(() => formatSequenceNumber(NumberPrefix.WORK_ORDER, 2026, 1.5)).toThrow();
  });

  it('usa el año de Bogotá y no el de UTC', () => {
    // 1 de enero 2027 03:00 UTC = 31 de diciembre 2026 22:00 en Bogotá
    expect(yearInBogota(new Date('2027-01-01T03:00:00Z'))).toBe(2026);
    expect(yearInBogota(new Date('2027-01-01T06:00:00Z'))).toBe(2027);
  });

  it('interpreta números existentes', () => {
    expect(parseSequenceNumber('OT-2026-000012')).toEqual({ prefix: 'OT', year: 2026, sequence: 12 });
    expect(parseSequenceNumber('abc')).toBeNull();
  });
});
