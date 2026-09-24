import type {
  AuthResponse,
  AuthUser,
  BrandProfileDto,
  BrandProfileInput,
  ChecklistResponseDto,
  ChecklistTemplateDto,
  ChecklistTemplateInput,
  ClientDto,
  ClientInput,
  CreateUserInput,
  CreateWorkOrderInput,
  DashboardSummary,
  EquipmentDto,
  EquipmentInput,
  EvidenceDto,
  HistoryEntryDto,
  Paginated,
  ReportDto,
  ServiceTypeDto,
  ServiceTypeInput,
  SignatureDto,
  StatusHistoryDto,
  SyncOperationInput,
  SyncOperationResult,
  UpdateBrandProfileInput,
  UpdateChecklistTemplateInput,
  UpdateClientInput,
  UpdateEquipmentInput,
  UpdateUserInput,
  UpdateWorkOrderInput,
  UserDto,
  WorkOrderBundle,
  WorkOrderDetail,
  WorkOrderListItem,
} from '@meca/shared';
import { api } from './client';

type Q = Record<string, string | number | boolean | undefined | string[]>;

export const authApi = {
  login: (email: string, password: string) => api.request<AuthResponse>('/auth/login', { method: 'POST', json: { email, password }, retry: false }),
  logout: () => api.csrfPost<void>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
  forgotPassword: (email: string) => api.request<{ message: string }>('/auth/forgot-password', { method: 'POST', json: { email }, retry: false }),
  resetPassword: (token: string, password: string) =>
    api.request<{ message: string }>('/auth/reset-password', { method: 'POST', json: { token, password }, retry: false }),
};

export const usersApi = {
  list: (q: Q) => api.get<Paginated<UserDto>>('/users', q),
  technicians: () => api.get<{ id: string; fullName: string; phone: string | null; jobTitle: string | null }[]>('/users/technicians'),
  create: (body: CreateUserInput) => api.post<UserDto>('/users', body),
  update: (id: string, body: UpdateUserInput) => api.patch<UserDto>(`/users/${id}`, body),
  setStatus: (id: string, active: boolean) => api.patch<UserDto>(`/users/${id}/status`, { active }),
};

export const clientsApi = {
  list: (q: Q) => api.get<Paginated<ClientDto>>('/clients', q),
  get: (id: string) => api.get<ClientDto>(`/clients/${id}`),
  create: (body: ClientInput) => api.post<ClientDto>('/clients', body),
  update: (id: string, body: UpdateClientInput) => api.patch<ClientDto>(`/clients/${id}`, body),
  equipment: (id: string, q: Q = {}) => api.get<Paginated<EquipmentDto>>(`/clients/${id}/equipment`, q),
  workOrders: (id: string, q: Q = {}) => api.get<Paginated<WorkOrderListItem>>(`/clients/${id}/work-orders`, q),
};

export const equipmentApi = {
  list: (q: Q) => api.get<Paginated<EquipmentDto>>('/equipment', q),
  get: (id: string) => api.get<EquipmentDto>(`/equipment/${id}`),
  create: (body: EquipmentInput) => api.post<EquipmentDto>('/equipment', body),
  update: (id: string, body: UpdateEquipmentInput) => api.patch<EquipmentDto>(`/equipment/${id}`, body),
  uploadPhoto: (id: string, file: Blob) => {
    const f = new FormData();
    f.append('file', file, 'equipo.jpg');
    return api.upload<EquipmentDto>(`/equipment/${id}/photo`, f);
  },
};

export const brandsApi = {
  list: (activeOnly = false) => api.get<BrandProfileDto[]>('/brand-profiles', activeOnly ? { active: 'true' } : undefined),
  create: (body: BrandProfileInput) => api.post<BrandProfileDto>('/brand-profiles', body),
  update: (id: string, body: UpdateBrandProfileInput) => api.patch<BrandProfileDto>(`/brand-profiles/${id}`, body),
  uploadLogo: (id: string, file: Blob) => {
    const f = new FormData();
    f.append('file', file, 'logo.png');
    return api.upload<BrandProfileDto>(`/brand-profiles/${id}/logo`, f);
  },
};

export const serviceTypesApi = {
  list: (activeOnly = false) => api.get<ServiceTypeDto[]>('/service-types', activeOnly ? { active: 'true' } : undefined),
  create: (body: ServiceTypeInput) => api.post<ServiceTypeDto>('/service-types', body),
  update: (id: string, body: Partial<ServiceTypeInput> & { active?: boolean }) => api.patch<ServiceTypeDto>(`/service-types/${id}`, body),
};

export const checklistsApi = {
  list: (q: Q) => api.get<Paginated<ChecklistTemplateDto>>('/checklist-templates', q),
  get: (id: string) => api.get<ChecklistTemplateDto>(`/checklist-templates/${id}`),
  create: (body: ChecklistTemplateInput) => api.post<ChecklistTemplateDto>('/checklist-templates', body),
  update: (id: string, body: UpdateChecklistTemplateInput) => api.patch<ChecklistTemplateDto>(`/checklist-templates/${id}`, body),
};

export const workOrdersApi = {
  list: (q: Q) => api.get<Paginated<WorkOrderListItem>>('/work-orders', q),
  get: (id: string) => api.get<WorkOrderDetail>(`/work-orders/${id}`),
  bundle: (id: string) => api.get<WorkOrderBundle>(`/work-orders/${id}/bundle`),
  create: (body: CreateWorkOrderInput) => api.post<WorkOrderDetail>('/work-orders', body),
  update: (id: string, body: UpdateWorkOrderInput) => api.patch<WorkOrderDetail>(`/work-orders/${id}`, body),
  assign: (id: string, technicianId: string) => api.post<WorkOrderDetail>(`/work-orders/${id}/assign`, { technicianId }),
  requestChanges: (id: string, comment: string) => api.post<WorkOrderDetail>(`/work-orders/${id}/request-changes`, { comment }),
  approve: (id: string) => api.post<{ workOrder: WorkOrderDetail; report: ReportDto }>(`/work-orders/${id}/approve`),
  close: (id: string) => api.post<WorkOrderDetail>(`/work-orders/${id}/close`),
  cancel: (id: string, reason: string) => api.post<WorkOrderDetail>(`/work-orders/${id}/cancel`, { reason }),
  waiveClientSignature: (id: string, reason: string) => api.post<WorkOrderDetail>(`/work-orders/${id}/client-signature-waiver`, { reason }),
  history: (id: string) => api.get<HistoryEntryDto[]>(`/work-orders/${id}/history`),
  statusHistory: (id: string) => api.get<StatusHistoryDto[]>(`/work-orders/${id}/status-history`),
  reports: (id: string) => api.get<ReportDto[]>(`/work-orders/${id}/reports`),
  regenerateReport: (id: string) => api.post<ReportDto>(`/work-orders/${id}/reports/generate`),
  preview: (id: string) => api.get<Blob>(`/work-orders/${id}/report-preview`),
};

export const reportsApi = {
  pdf: (id: string) => api.get<Blob>(`/reports/${id}/pdf`),
};

export const dashboardApi = { summary: () => api.get<DashboardSummary>('/dashboard') };

/** Endpoints usados por el motor de sincronización del técnico. */
export const syncApi = {
  pull: () => api.get<{ serverTime: string; bundles: WorkOrderBundle[] }>('/sync/pull'),
  batch: (operations: SyncOperationInput[]) => api.post<{ results: SyncOperationResult[] }>('/sync/batch', { operations }),
  uploadEvidence: (workOrderId: string, form: FormData) => api.upload<EvidenceDto>(`/work-orders/${workOrderId}/evidence`, form),
  uploadSignature: (workOrderId: string, form: FormData) => api.upload<SignatureDto>(`/work-orders/${workOrderId}/signatures`, form),
  checklist: (workOrderId: string) => api.get<ChecklistResponseDto[]>(`/work-orders/${workOrderId}/checklist`),
};
