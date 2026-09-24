import type { Prisma } from '@prisma/client';

export const userRef = { select: { id: true, fullName: true } } as const;
const clientRef = { select: { id: true, legalName: true, tradeName: true, nit: true, dv: true } } as const;

export const listInclude = {
  client: clientRef,
  equipment: { select: { id: true, code: true, name: true, serial: true } },
  assignedTechnician: userRef,
  serviceType: { select: { id: true, name: true, code: true } },
  checklistExecution: { select: { responses: { select: { responseType: true, value: true } } } },
} satisfies Prisma.WorkOrderInclude;

export const detailInclude = {
  client: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      nit: true,
      dv: true,
      address: true,
      city: true,
      department: true,
      phone: true,
    },
  },
  equipment: {
    select: { id: true, code: true, name: true, serial: true, brand: true, model: true, location: true, category: true },
  },
  assignedTechnician: userRef,
  serviceType: { select: { id: true, name: true, code: true } },
  representedCompany: { select: { id: true, name: true, primaryColor: true } },
  checklistTemplate: { select: { id: true, name: true, version: true } },
  createdBy: userRef,
  checklistExecution: { select: { responses: { select: { responseType: true, value: true } } } },
} satisfies Prisma.WorkOrderInclude;

export type WorkOrderListRow = Prisma.WorkOrderGetPayload<{ include: typeof listInclude }>;
export type WorkOrderDetailRow = Prisma.WorkOrderGetPayload<{ include: typeof detailInclude }>;
