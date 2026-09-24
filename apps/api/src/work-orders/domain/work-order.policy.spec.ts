import { Permission, Role, WorkOrderStatus, permissionsFor } from '@meca/shared';
import { WorkOrderPolicy } from './work-order.policy';

const tech = { id: 't1', permissions: permissionsFor(Role.TECHNICIAN) };
const coordinator = { id: 'c1', permissions: permissionsFor(Role.COORDINATOR) };

describe('WorkOrderPolicy', () => {
  it('el técnico solo lee sus órdenes fuera de borrador', () => {
    expect(WorkOrderPolicy.canRead(tech, { status: WorkOrderStatus.ASSIGNED, assignedTechnicianId: 't1' })).toBe(true);
    expect(WorkOrderPolicy.canRead(tech, { status: WorkOrderStatus.ASSIGNED, assignedTechnicianId: 't2' })).toBe(false);
    expect(WorkOrderPolicy.canRead(tech, { status: WorkOrderStatus.DRAFT, assignedTechnicianId: 't1' })).toBe(false);
    expect(WorkOrderPolicy.canRead(coordinator, { status: WorkOrderStatus.DRAFT, assignedTechnicianId: null })).toBe(true);
  });

  it('solo el asignado ejecuta y solo en ejecución o corrección (RB-005)', () => {
    expect(() => WorkOrderPolicy.assertCanExecute(tech, { status: WorkOrderStatus.IN_PROGRESS, assignedTechnicianId: 't1' })).not.toThrow();
    expect(() => WorkOrderPolicy.assertCanExecute(tech, { status: WorkOrderStatus.CHANGES_REQUESTED, assignedTechnicianId: 't1' })).not.toThrow();
    expect(() => WorkOrderPolicy.assertCanExecute(tech, { status: WorkOrderStatus.IN_PROGRESS, assignedTechnicianId: 't2' })).toThrow();
    expect(() => WorkOrderPolicy.assertCanExecute(tech, { status: WorkOrderStatus.PENDING_REVIEW, assignedTechnicianId: 't1' })).toThrow();
    expect(() => WorkOrderPolicy.assertCanExecute(tech, { status: WorkOrderStatus.ACCEPTED, assignedTechnicianId: 't1' })).toThrow(
      'Debe iniciar el servicio antes de registrar información.',
    );
  });

  it('un coordinador no ejecuta servicios de campo', () => {
    expect(coordinator.permissions.includes(Permission.WORK_ORDERS_EXECUTE)).toBe(false);
    expect(() => WorkOrderPolicy.assertCanExecute({ ...coordinator, id: 'c1' }, { status: WorkOrderStatus.IN_PROGRESS, assignedTechnicianId: 'c1' })).toThrow();
  });
});
