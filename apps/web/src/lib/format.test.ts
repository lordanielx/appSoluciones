import { describe, expect, it } from 'vitest';
import { bogotaDayKey, fromBogotaInput, greeting, toBogotaInput } from './format';

describe('formato en hora de Colombia', () => {
  it('convierte datetime-local de Bogotá a UTC y de vuelta', () => {
    expect(fromBogotaInput('2026-09-24T08:00')).toBe('2026-09-24T13:00:00.000Z');
    expect(toBogotaInput('2026-09-24T13:00:00.000Z')).toBe('2026-09-24T08:00');
  });
  it('agrupa por día de Bogotá', () => {
    expect(bogotaDayKey('2026-09-24T03:00:00Z')).toBe('2026-09-23');
  });
  it('saluda según la hora local', () => {
    expect(greeting(new Date('2026-09-24T13:00:00Z'))).toBe('Buenos días');
    expect(greeting(new Date('2026-09-24T20:00:00Z'))).toBe('Buenas tardes');
    expect(greeting(new Date('2026-09-25T02:00:00Z'))).toBe('Buenas noches');
  });
});
