# ADR-004 · Estrategia offline con IndexedDB (Dexie) y outbox

- **Estado:** aceptada · 2026-09-24

## Decisión
La interfaz del técnico lee y escribe en IndexedDB (Dexie). Cada cambio genera
una operación en un outbox local con `clientOperationId`; un motor de
sincronización la envía en orden (lote JSON + multipart) y el servidor garantiza
idempotencia. La API no se cachea en el service worker.

## Alternativas descartadas
- Cachear respuestas HTTP en Workbox: no modela escrituras ni conflictos.
- Background Sync API: soporte desigual (iOS).
- CRDT/replicación completa (PouchDB): excesivo para un técnico por OT.

## Consecuencias
Conflictos explícitos por versión (solo checklist y datos de OT), resolución
visible por el usuario; nunca se ocultan errores. Detalle en `docs/offline-sync.md`.
