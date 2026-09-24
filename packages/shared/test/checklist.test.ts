import { describe, expect, it } from 'vitest';
import {
  evaluateSubmission,
  isObservationRequired,
  requiredPhotos,
  ResponseType,
  SignatureType,
  StatusValue,
  SubmissionIssueCode,
  validateValueShape,
  type ChecklistItemState,
} from '../src';

const item = (overrides: Partial<ChecklistItemState>): ChecklistItemState => ({
  id: 'i1',
  label: 'Verificar nivel de aceite',
  responseType: ResponseType.STATUS,
  required: true,
  evidenceRequired: false,
  minPhotos: 0,
  observationRequired: false,
  options: [],
  value: null,
  observation: null,
  photoCount: 0,
  ...overrides,
});

const complete = {
  technicianNotes: 'Equipo operando dentro de parámetros.',
  signatureTypes: [SignatureType.TECHNICIAN, SignatureType.CLIENT],
  clientSignatureWaived: false,
};

describe('validación de finalización', () => {
  it('permite enviar cuando todo está completo', () => {
    const r = evaluateSubmission({ ...complete, items: [item({ value: StatusValue.GOOD })] });
    expect(r.canSubmit).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('RB-006: exige ítems obligatorios', () => {
    const r = evaluateSubmission({ ...complete, items: [item({}), item({ id: 'i2', required: false })] });
    expect(r.canSubmit).toBe(false);
    expect(r.checklistComplete).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe(SubmissionIssueCode.ITEM_UNANSWERED);
  });

  it('RB-007: exige evidencia con mensaje exacto', () => {
    const r = evaluateSubmission({
      ...complete,
      items: [item({ label: 'Estado del motor', value: StatusValue.GOOD, evidenceRequired: true, minPhotos: 1 })],
    });
    expect(r.evidenceComplete).toBe(false);
    expect(r.issues[0]?.message).toBe('Falta evidencia en "Estado del motor".');
  });

  it('RB-007: "No aplica" no exige fotografía', () => {
    const i = item({ value: StatusValue.NOT_APPLICABLE, evidenceRequired: true, minPhotos: 2 });
    expect(requiredPhotos(i, i.value)).toBe(0);
  });

  it('RB-008: estados críticos y valores fuera de rango exigen observación', () => {
    expect(isObservationRequired(item({}), StatusValue.CRITICAL)).toBe(true);
    expect(isObservationRequired(item({}), StatusValue.GOOD)).toBe(false);
    const n = item({ responseType: ResponseType.NUMBER, minValue: 10, maxValue: 20 });
    expect(isObservationRequired(n, 25)).toBe(true);
    expect(isObservationRequired(n, 15)).toBe(false);
    const r = evaluateSubmission({ ...complete, items: [item({ value: StatusValue.CRITICAL })] });
    expect(r.issues[0]?.code).toBe(SubmissionIssueCode.ITEM_OBSERVATION_MISSING);
  });

  it('RB-009/RB-010: exige firmas, salvo excepción registrada del cliente', () => {
    const base = { items: [item({ value: StatusValue.GOOD })], technicianNotes: 'ok' };
    const none = evaluateSubmission({ ...base, signatureTypes: [], clientSignatureWaived: false });
    expect(none.issues.map((i) => i.message)).toEqual(['Falta la firma del técnico.', 'Falta la firma del cliente.']);
    const waived = evaluateSubmission({
      ...base,
      signatureTypes: [SignatureType.TECHNICIAN],
      clientSignatureWaived: true,
    });
    expect(waived.canSubmit).toBe(true);
  });

  it('exige conclusiones técnicas', () => {
    const r = evaluateSubmission({ ...complete, technicianNotes: '  ', items: [] });
    expect(r.issues[0]?.code).toBe(SubmissionIssueCode.NOTES_MISSING);
  });

  it('valida la forma de los valores por tipo', () => {
    const select = item({ responseType: ResponseType.SELECT, options: ['A', 'B'] });
    expect(validateValueShape(select, 'A')).toBeNull();
    expect(validateValueShape(select, 'C')).not.toBeNull();
    expect(validateValueShape(item({ responseType: ResponseType.NUMBER }), 'x')).not.toBeNull();
    expect(validateValueShape(item({}), 'INVENTADO')).not.toBeNull();
    const multi = item({ responseType: ResponseType.MULTISELECT, options: ['A', 'B'] });
    expect(validateValueShape(multi, ['A', 'B'])).toBeNull();
    expect(validateValueShape(multi, ['A', 'Z'])).not.toBeNull();
  });
});
