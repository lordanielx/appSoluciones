import { describe, expect, it } from 'vitest';
import {
  WorkOrderAction,
  WorkOrderStatus as S,
  availableActions,
  canTransition,
  nextStatus,
  permissionsFor,
  Role,
  TRANSITIONS,
  type WorkOrderStatus,
} from '../src';

describe('máquina de estados de OT', () => {
  it('recorre el flujo principal DRAFT → CLOSED', () => {
    const path: [WorkOrderAction, WorkOrderStatus][] = [
      [WorkOrderAction.ASSIGN, S.ASSIGNED],
      [WorkOrderAction.ACCEPT, S.ACCEPTED],
      [WorkOrderAction.START, S.IN_PROGRESS],
      [WorkOrderAction.SUBMIT, S.PENDING_REVIEW],
      [WorkOrderAction.APPROVE, S.APPROVED],
      [WorkOrderAction.CLOSE, S.CLOSED],
    ];
    let status: WorkOrderStatus = S.DRAFT;
    for (const [action, expected] of path) {
      const next = nextStatus(action, status);
      expect(next).toBe(expected);
      status = next as WorkOrderStatus;
    }
  });

  it('no permite saltos arbitrarios', () => {
    expect(canTransition(WorkOrderAction.START, S.ASSIGNED)).toBe(false);
    expect(canTransition(WorkOrderAction.SUBMIT, S.ACCEPTED)).toBe(false);
    expect(canTransition(WorkOrderAction.APPROVE, S.IN_PROGRESS)).toBe(false);
    expect(canTransition(WorkOrderAction.CLOSE, S.PENDING_REVIEW)).toBe(false);
    expect(canTransition(WorkOrderAction.ACCEPT, S.DRAFT)).toBe(false);
  });

  it('permite rechazo y reasignación', () => {
    expect(nextStatus(WorkOrderAction.REJECT, S.ASSIGNED)).toBe(S.REJECTED);
    expect(nextStatus(WorkOrderAction.ASSIGN, S.REJECTED)).toBe(S.ASSIGNED);
  });

  it('permite el ciclo de corrección', () => {
    expect(nextStatus(WorkOrderAction.REQUEST_CHANGES, S.PENDING_REVIEW)).toBe(S.CHANGES_REQUESTED);
    expect(nextStatus(WorkOrderAction.START, S.CHANGES_REQUESTED)).toBe(S.IN_PROGRESS);
    expect(nextStatus(WorkOrderAction.SUBMIT, S.CHANGES_REQUESTED)).toBe(S.PENDING_REVIEW);
  });

  it('estados terminales no aceptan acciones salvo reapertura de aprobadas', () => {
    for (const action of Object.keys(TRANSITIONS) as WorkOrderAction[]) {
      expect(canTransition(action, S.CLOSED)).toBe(false);
      expect(canTransition(action, S.CANCELLED)).toBe(false);
    }
    expect(canTransition(WorkOrderAction.CANCEL, S.APPROVED)).toBe(false);
  });

  it('las acciones disponibles dependen del rol y de la asignación', () => {
    const tech = permissionsFor(Role.TECHNICIAN);
    expect(availableActions({ status: S.ASSIGNED, permissions: tech, isAssignee: true })).toEqual([
      WorkOrderAction.ACCEPT,
      WorkOrderAction.REJECT,
    ]);
    expect(availableActions({ status: S.ASSIGNED, permissions: tech, isAssignee: false })).toEqual([]);

    const coordinator = permissionsFor(Role.COORDINATOR);
    const actions = availableActions({ status: S.PENDING_REVIEW, permissions: coordinator, isAssignee: false });
    expect(actions).toContain(WorkOrderAction.APPROVE);
    expect(actions).toContain(WorkOrderAction.REQUEST_CHANGES);
    expect(actions).not.toContain(WorkOrderAction.SUBMIT);
  });
});
