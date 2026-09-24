/**
 * Contratos de respuesta de la API (JSON). Las fechas viajan como ISO-8601 (UTC).
 */
import type {
  AuditAction,
  Priority,
  ReportStatus,
  ResponseType,
  Role,
  SignatureType,
  WorkOrderStatus,
} from './enums';
import type { ChecklistValue } from './checklist';
import type { Permission } from './permissions';
import type { WorkOrderAction } from './state-machine';

export type ISODate = string;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: Permission[];
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  jobTitle: string | null;
  active: boolean;
  lastLoginAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ClientDto {
  id: string;
  legalName: string;
  tradeName: string | null;
  nit: string;
  dv: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  notes: string | null;
  active: boolean;
  equipmentCount?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ClientRef {
  id: string;
  legalName: string;
  tradeName: string | null;
  nit: string;
  dv: string | null;
}

export interface EquipmentDto {
  id: string;
  clientId: string;
  client?: ClientRef;
  code: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  description: string | null;
  specifications: string | null;
  notes: string | null;
  photoUrl: string | null;
  active: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface BrandProfileDto {
  id: string;
  name: string;
  legalName: string;
  nit: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primaryColor: string;
  secondaryColor: string;
  footerText: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ServiceTypeDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requiresEquipment: boolean;
  active: boolean;
}

export interface ChecklistItemTemplateDto {
  id: string;
  order: number;
  section: string | null;
  label: string;
  description: string | null;
  responseType: ResponseType;
  required: boolean;
  evidenceRequired: boolean;
  minPhotos: number;
  observationRequired: boolean;
  options: string[];
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
}

export interface ChecklistTemplateDto {
  id: string;
  name: string;
  serviceTypeId: string | null;
  serviceType: Pick<ServiceTypeDto, 'id' | 'name' | 'code'> | null;
  description: string | null;
  version: number;
  active: boolean;
  itemCount: number;
  items?: ChecklistItemTemplateDto[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface UserRef {
  id: string;
  fullName: string;
}

export interface WorkOrderListItem {
  id: string;
  number: string;
  title: string;
  status: WorkOrderStatus;
  priority: Priority;
  scheduledStart: ISODate | null;
  scheduledEnd: ISODate | null;
  client: ClientRef;
  equipment: Pick<EquipmentDto, 'id' | 'code' | 'name' | 'serial'> | null;
  technician: UserRef | null;
  serviceType: Pick<ServiceTypeDto, 'id' | 'name' | 'code'>;
  checklistProgress: { answered: number; total: number };
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ChecklistResponseDto {
  id: string;
  order: number;
  section: string | null;
  label: string;
  description: string | null;
  responseType: ResponseType;
  required: boolean;
  evidenceRequired: boolean;
  minPhotos: number;
  observationRequired: boolean;
  options: string[];
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  value: ChecklistValue;
  observation: string | null;
  version: number;
  answeredAt: ISODate | null;
  answeredBy: UserRef | null;
}

export interface EvidenceDto {
  id: string;
  workOrderId: string;
  checklistResponseId: string | null;
  caption: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  capturedAt: ISODate | null;
  uploadedAt: ISODate;
  createdBy: UserRef;
  url: string;
  thumbnailUrl: string;
}

export interface SignatureDto {
  id: string;
  workOrderId: string;
  signatureType: SignatureType;
  signerName: string;
  signerRole: string | null;
  signedAt: ISODate;
  consentAccepted: boolean;
  createdBy: UserRef;
  pngUrl: string;
  svgUrl: string;
}

export interface ReportDto {
  id: string;
  workOrderId: string;
  reportNumber: string;
  version: number;
  status: ReportStatus;
  sizeBytes: number;
  generatedBy: UserRef;
  generatedAt: ISODate;
  approvedBy: UserRef | null;
  approvedAt: ISODate | null;
  brandProfileName: string;
}

export interface StatusHistoryDto {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  comment: string | null;
  actor: UserRef;
  createdAt: ISODate;
}

export interface HistoryEntryDto {
  id: string;
  action: AuditAction;
  description: string;
  actor: UserRef | null;
  metadata: Record<string, unknown>;
  createdAt: ISODate;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  description: string | null;
  serviceScope: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  internalNotes: string | null;
  technicianNotes: string | null;
  rejectionReason: string | null;
  changesRequestedComment: string | null;
  cancellationReason: string | null;
  clientSignatureWaived: boolean;
  clientSignatureWaiverReason: string | null;
  version: number;
  client: ClientRef & {
    address: string | null;
    city: string | null;
    department: string | null;
    phone: string | null;
  };
  equipment: Pick<
    EquipmentDto,
    'id' | 'code' | 'name' | 'serial' | 'brand' | 'model' | 'location' | 'category'
  > | null;
  representedCompany: Pick<BrandProfileDto, 'id' | 'name' | 'primaryColor'>;
  checklistTemplate: Pick<ChecklistTemplateDto, 'id' | 'name' | 'version'>;
  createdBy: UserRef;
  assignedAt: ISODate | null;
  acceptedAt: ISODate | null;
  startedAt: ISODate | null;
  submittedAt: ISODate | null;
  approvedAt: ISODate | null;
  closedAt: ISODate | null;
  cancelledAt: ISODate | null;
  availableActions: WorkOrderAction[];
}

/** Paquete completo que el técnico descarga para trabajar offline. */
export interface WorkOrderBundle {
  workOrder: WorkOrderDetail;
  checklist: ChecklistResponseDto[];
  evidence: EvidenceDto[];
  signatures: SignatureDto[];
  statusHistory: StatusHistoryDto[];
}

export interface DashboardSummary {
  counters: {
    open: number;
    assigned: number;
    inProgress: number;
    pendingReview: number;
    changesRequested: number;
    completedToday: number;
  };
  recentWorkOrders: WorkOrderListItem[];
  recentActivity: (HistoryEntryDto & { workOrder: { id: string; number: string } | null })[];
}
