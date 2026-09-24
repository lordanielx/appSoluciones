import { Role } from './enums';

/**
 * RBAC: los roles tienen conjuntos fijos de permisos. El backend siempre valida
 * con estos permisos; el frontend los usa únicamente para adaptar la interfaz.
 */
export const Permission = {
  USERS_MANAGE: 'USERS_MANAGE',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
  CLIENTS_READ: 'CLIENTS_READ',
  CLIENTS_MANAGE: 'CLIENTS_MANAGE',
  EQUIPMENT_READ: 'EQUIPMENT_READ',
  EQUIPMENT_MANAGE: 'EQUIPMENT_MANAGE',
  BRANDS_MANAGE: 'BRANDS_MANAGE',
  CHECKLISTS_READ: 'CHECKLISTS_READ',
  CHECKLISTS_MANAGE: 'CHECKLISTS_MANAGE',
  SERVICE_TYPES_MANAGE: 'SERVICE_TYPES_MANAGE',
  WORK_ORDERS_READ_ALL: 'WORK_ORDERS_READ_ALL',
  WORK_ORDERS_READ_OWN: 'WORK_ORDERS_READ_OWN',
  WORK_ORDERS_MANAGE: 'WORK_ORDERS_MANAGE',
  WORK_ORDERS_ASSIGN: 'WORK_ORDERS_ASSIGN',
  WORK_ORDERS_EXECUTE: 'WORK_ORDERS_EXECUTE',
  WORK_ORDERS_REVIEW: 'WORK_ORDERS_REVIEW',
  WORK_ORDERS_WAIVE_CLIENT_SIGNATURE: 'WORK_ORDERS_WAIVE_CLIENT_SIGNATURE',
  REPORTS_READ: 'REPORTS_READ',
  REPORTS_GENERATE: 'REPORTS_GENERATE',
  AUDIT_READ: 'AUDIT_READ',
  DASHBOARD_READ: 'DASHBOARD_READ',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.ADMIN]: ALL_PERMISSIONS.filter((p) => p !== Permission.WORK_ORDERS_EXECUTE),
  [Role.COORDINATOR]: [
    Permission.CLIENTS_READ,
    Permission.CLIENTS_MANAGE,
    Permission.EQUIPMENT_READ,
    Permission.EQUIPMENT_MANAGE,
    Permission.CHECKLISTS_READ,
    Permission.WORK_ORDERS_READ_ALL,
    Permission.WORK_ORDERS_MANAGE,
    Permission.WORK_ORDERS_ASSIGN,
    Permission.WORK_ORDERS_REVIEW,
    Permission.WORK_ORDERS_WAIVE_CLIENT_SIGNATURE,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.AUDIT_READ,
    Permission.DASHBOARD_READ,
  ],
  [Role.TECHNICIAN]: [
    Permission.WORK_ORDERS_READ_OWN,
    Permission.WORK_ORDERS_EXECUTE,
    Permission.REPORTS_READ,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
