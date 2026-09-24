# ADR-007 · RBAC con permisos por rol

- **Estado:** aceptada · 2026-09-24

## Decisión
Tres roles (ADMINISTRADOR, COORDINADOR, TÉCNICO) con conjuntos fijos de permisos
definidos en código (`packages/shared/src/permissions.ts`). Los endpoints exigen
permisos (`@RequirePermissions`), y las reglas por recurso (técnico asignado,
estado editable) viven en `WorkOrderPolicy`. El rol "revisor" es el permiso
`WORK_ORDERS_REVIEW` (ADMIN y COORDINADOR). Sin ABAC.

## Consecuencias
Reglas auditables y probadas unitariamente; el frontend usa la misma tabla para
ocultar acciones, pero el servidor siempre valida. Roles configurables en BD
quedan para una fase posterior si se requieren (la API ya razona por permisos,
no por nombre de rol).
