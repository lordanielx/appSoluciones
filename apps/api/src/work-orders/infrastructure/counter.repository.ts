import { Injectable } from '@nestjs/common';
import { counterKey, formatSequenceNumber, yearInBogota, type NumberPrefix } from '@meca/shared';
import type { Tx } from '../../prisma/prisma.service';

/**
 * Consecutivos legibles por año. El incremento es atómico (fila bloqueada por
 * ON CONFLICT DO UPDATE) y participa de la transacción de negocio: si esta falla,
 * el número no se consume.
 */
@Injectable()
export class CounterRepository {
  async next(tx: Tx, prefix: NumberPrefix, now = new Date()): Promise<string> {
    const year = yearInBogota(now);
    const key = counterKey(prefix, year);
    const rows = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
      RETURNING "value"`;
    const value = rows[0]?.value;
    if (value === undefined) throw new Error('No fue posible generar el consecutivo');
    return formatSequenceNumber(prefix, year, Number(value));
  }
}
