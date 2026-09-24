import { startOfDayBogota } from './timezone';

describe('startOfDayBogota', () => {
  it('calcula la medianoche de Bogotá en UTC', () => {
    expect(startOfDayBogota(new Date('2026-09-24T03:00:00Z')).toISOString()).toBe('2026-09-23T05:00:00.000Z');
    expect(startOfDayBogota(new Date('2026-09-24T15:00:00Z')).toISOString()).toBe('2026-09-24T05:00:00.000Z');
  });
});
