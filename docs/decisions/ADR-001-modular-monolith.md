# ADR-001 · Monolito modular

- **Estado:** aceptada · 2026-09-24

## Contexto
MVP para una sola empresa, equipo pequeño, presupuesto operativo reducido y
necesidad de iterar rápido sobre un flujo transaccional (OT → informe).

## Decisión
Una sola API NestJS desplegable, organizada en módulos con límites explícitos
(`auth`, `clients`, `equipment`, `work-orders`, `evidence`, `signatures`,
`reports`, `sync`, `audit`, …) y capas `domain / application / infrastructure /
presentation`. Reglas compartidas con el frontend en `@meca/shared`.

## Consecuencias
- Transacciones ACID entre OT, checklist, evidencias, auditoría e informe sin
  sagas ni mensajería.
- Un solo pipeline, una imagen, un proceso que monitorear.
- Los módulos pueden extraerse después (p. ej. `reports` como worker) porque se
  comunican por servicios con interfaces claras y sin dependencias circulares.
- Riesgo: acoplamiento accidental; se mitiga con `WorkOrderCoreModule` y revisiones.
