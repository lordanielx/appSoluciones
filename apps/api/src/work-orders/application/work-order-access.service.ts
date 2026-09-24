import { Injectable } from '@nestjs/common';
import type { WorkOrder } from '@prisma/client';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { WorkOrderPolicy } from '../domain/work-order.policy';

/** Carga una OT verificando que el usuario pueda verla (404 si no, para no revelar su existencia). */
@Injectable()
export class WorkOrderAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async loadReadable(id: string, user: AuthenticatedUser, tx?: Tx): Promise<WorkOrder> {
    const wo = await (tx ?? this.prisma).workOrder.findUnique({ where: { id } });
    if (!wo || !WorkOrderPolicy.canRead(user, wo)) throw AppException.notFound('La orden de trabajo');
    return wo;
  }

  /** Carga la OT con bloqueo de fila (SELECT … FOR UPDATE) dentro de una transacción. */
  async lockForUpdate(tx: Tx, id: string, user: AuthenticatedUser): Promise<WorkOrder> {
    await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id = ${id}::uuid FOR UPDATE`;
    return this.loadReadable(id, user, tx);
  }

  async loadExecutable(tx: Tx, id: string, user: AuthenticatedUser): Promise<WorkOrder> {
    const wo = await this.lockForUpdate(tx, id, user);
    WorkOrderPolicy.assertCanExecute(user, wo);
    return wo;
  }
}
