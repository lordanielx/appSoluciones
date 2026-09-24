# ADR-002 · PostgreSQL + Prisma

- **Estado:** aceptada · 2026-09-24

## Decisión
PostgreSQL 16 como base transaccional, con Prisma ORM y migraciones versionadas
(`prisma migrate`); nunca `synchronize`/`db push` en entornos compartidos.

## Razones
Integridad referencial, transacciones y bloqueo de fila (`SELECT … FOR UPDATE`)
para transiciones de estado; `INSERT … ON CONFLICT` para consecutivos atómicos;
`JSONB` para valores heterogéneos del checklist y metadatos de auditoría; índices
para búsquedas server-side; oferta gestionada amplia con PITR.

## Consecuencias
Binarios fuera de la base (ADR-005). Consultas especiales (bloqueos, contadores)
con `$queryRaw` parametrizado.
