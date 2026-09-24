import { describe, expect, it } from 'vitest';
import { checklistItemTemplateSchema, clientSchema, passwordSchema, ResponseType } from '../src';

describe('esquemas compartidos', () => {
  it('normaliza el NIT y vacíos opcionales', () => {
    const r = clientSchema.parse({ legalName: 'Industrias Andinas S.A.S.', nit: '900.123.456', email: '' });
    expect(r.nit).toBe('900123456');
    expect(r.email).toBeNull();
    expect(r.tradeName).toBeNull();
  });

  it('exige opciones en selección', () => {
    const r = checklistItemTemplateSchema.safeParse({ label: 'Tipo', responseType: ResponseType.SELECT, options: ['A'] });
    expect(r.success).toBe(false);
  });

  it('evidencia obligatoria implica mínimo una foto', () => {
    const r = checklistItemTemplateSchema.parse({ label: 'Placa', responseType: ResponseType.BOOLEAN, evidenceRequired: true });
    expect(r.minPhotos).toBe(1);
  });

  it('aplica la política de contraseña', () => {
    expect(passwordSchema.safeParse('corta1').success).toBe(false);
    expect(passwordSchema.safeParse('solamenteletras').success).toBe(false);
    expect(passwordSchema.safeParse('Mecaelectric2026').success).toBe(true);
  });
});
