import { describe, expect, it } from 'vitest';
import { hasPermission, Permission, Role } from '../src';

describe('RBAC', () => {
  it('el técnico solo ve sus órdenes y ejecuta', () => {
    expect(hasPermission(Role.TECHNICIAN, Permission.WORK_ORDERS_READ_OWN)).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, Permission.WORK_ORDERS_READ_ALL)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.WORK_ORDERS_EXECUTE)).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, Permission.CLIENTS_MANAGE)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.WORK_ORDERS_REVIEW)).toBe(false);
  });

  it('el coordinador revisa pero no administra usuarios ni configuración', () => {
    expect(hasPermission(Role.COORDINATOR, Permission.WORK_ORDERS_REVIEW)).toBe(true);
    expect(hasPermission(Role.COORDINATOR, Permission.USERS_MANAGE)).toBe(false);
    expect(hasPermission(Role.COORDINATOR, Permission.CHECKLISTS_MANAGE)).toBe(false);
    expect(hasPermission(Role.COORDINATOR, Permission.BRANDS_MANAGE)).toBe(false);
  });

  it('el administrador tiene acceso total excepto ejecutar servicios de campo', () => {
    for (const p of Object.values(Permission)) {
      expect(hasPermission(Role.ADMIN, p)).toBe(p !== Permission.WORK_ORDERS_EXECUTE);
    }
  });
});
