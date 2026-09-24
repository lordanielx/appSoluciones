import type { ChecklistValue, ResponseType, Priority } from '@meca/shared';

export interface ReportBrand {
  name: string;
  legalName: string;
  nit: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primaryColor: string;
  secondaryColor: string;
  footerText: string | null;
  logoDataUri: string | null;
}

export interface ReportChecklistRow {
  order: number;
  section: string | null;
  label: string;
  responseType: ResponseType;
  value: ChecklistValue;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  observation: string | null;
  photoNumbers: number[];
}

export interface ReportPhoto {
  number: number;
  dataUri: string;
  caption: string | null;
  activity: string | null;
  capturedAt: Date | null;
}

export interface ReportSignature {
  signerName: string;
  signerRole: string | null;
  signedAt: Date;
  pngDataUri: string;
}

/** Todo lo que necesita la plantilla. Se arma en una transacción para que sea consistente. */
export interface ReportData {
  reportNumber: string;
  version: number;
  generatedAt: Date;
  preview: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  brand: ReportBrand;
  workOrder: {
    number: string;
    title: string;
    serviceType: string;
    priority: Priority;
    description: string | null;
    serviceScope: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    scheduledStart: Date | null;
    startedAt: Date | null;
    submittedAt: Date | null;
    technicianNotes: string | null;
    technician: string | null;
    clientSignatureWaived: boolean;
    clientSignatureWaiverReason: string | null;
    clientSignatureWaivedBy: string | null;
  };
  client: {
    legalName: string;
    tradeName: string | null;
    nit: string;
    dv: string | null;
    address: string | null;
    city: string | null;
    department: string | null;
  };
  equipment: {
    code: string;
    name: string;
    category: string | null;
    brand: string | null;
    model: string | null;
    serial: string | null;
    location: string | null;
    description: string | null;
  } | null;
  checklist: ReportChecklistRow[];
  photos: ReportPhoto[];
  technicianSignature: ReportSignature | null;
  clientSignature: ReportSignature | null;
}
