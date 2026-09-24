# Arquitectura — Mecaelectric Operaciones

Monolito modular (ADR-001) con una PWA React para dos experiencias: administración
(escritorio) y técnico (móvil, local-first). La API NestJS es la única fuente de
verdad; PostgreSQL guarda datos estructurados y el object storage guarda binarios
(fotos, firmas, PDF, logos).

## C4 — Contexto

```mermaid
C4Context
  title Contexto del sistema
  Person(admin, "Administración / Coordinación", "Crea OT, asigna, revisa y aprueba informes")
  Person(tech, "Técnico de campo", "Ejecuta el servicio desde el teléfono, con o sin señal")
  Person_Ext(client, "Responsable del cliente", "Firma la conformidad en el dispositivo del técnico")
  System(meca, "Mecaelectric Operaciones", "PWA + API: OT, checklist, evidencias, firmas, informe PDF, trazabilidad")
  System_Ext(mail, "Servidor de correo (SMTP)", "Recuperación de contraseña (pendiente de proveedor)")
  Rel(admin, meca, "Usa", "HTTPS")
  Rel(tech, meca, "Usa (offline controlado)", "HTTPS")
  Rel(client, tech, "Firma en el dispositivo")
  Rel(meca, mail, "Envía enlaces", "SMTP")
```

## C4 — Contenedores (simplificado)

```mermaid
C4Container
  title Contenedores
  Person(user, "Usuario")
  Container_Boundary(b, "Mecaelectric Operaciones") {
    Container(pwa, "PWA", "React, Vite, Tailwind, Dexie, Workbox", "Interfaz administración / técnico. IndexedDB + outbox offline. Service worker con precache.")
    Container(nginx, "Nginx", "Reverse proxy", "Sirve la PWA y enruta /api al backend (mismo origen)")
    Container(api, "API", "NestJS 11, Prisma 6, Zod", "Módulos: auth, users, clients, equipment, brand-profiles, service-types, checklist-templates, work-orders, checklist-execution, evidence, signatures, reports, sync, audit, health")
    ContainerDb(db, "PostgreSQL 16", "Datos transaccionales, auditoría, consecutivos, idempotencia")
    Container(storage, "Object storage", "MinIO / S3", "evidence/, signatures/, reports/, branding/, equipment/")
    Container(chromium, "Chromium", "Playwright", "HTML → PDF del informe")
  }
  Rel(user, pwa, "Usa", "HTTPS")
  Rel(pwa, nginx, "Carga / API REST", "HTTPS")
  Rel(nginx, api, "Proxy /api/v1")
  Rel(api, db, "Prisma", "TCP")
  Rel(api, storage, "S3 API")
  Rel(api, chromium, "Render PDF")
  Rel(pwa, storage, "Descarga con URL firmada", "HTTPS")
```

## Backend: módulos y capas

Cada módulo separa (sin abstracciones innecesarias):

| Capa | Contenido | Ejemplo |
|------|-----------|---------|
| `domain/` | Reglas puras sin I/O | `work-order.policy.ts`, `strokes.ts`, `report-data.ts` |
| `application/` | Casos de uso (comandos / consultas), transacciones, auditoría | `work-order-lifecycle.commands.ts`, `work-order.queries.ts` |
| `infrastructure/` | Persistencia específica, integraciones | `counter.repository.ts`, `pdf-renderer.ts`, `report-template.ts` |
| `presentation/` | Controladores delgados: validación Zod, OpenAPI, permisos | `work-orders.controller.ts` |

Reglas transversales en `@meca/shared` (usadas por API **y** PWA):
máquina de estados (`state-machine.ts`), RBAC (`permissions.ts`), reglas de
finalización RB-006..RB-010 (`checklist.ts`), numeración, esquemas Zod y DTOs.

```mermaid
flowchart LR
  subgraph shared["@meca/shared"]
    SM[state-machine] --- RB[checklist rules] --- PERM[RBAC] --- ZOD[zod schemas]
  end
  subgraph api["apps/api"]
    CTRL[controllers] --> CMD[commands/queries] --> DOM[domain policy]
    CMD --> PRISMA[(Prisma)]
    CMD --> STORE[StorageService]
    CMD --> AUD[AuditService]
  end
  subgraph web["apps/web"]
    UI[pages] --> Q[TanStack Query] --> HTTP[api client]
    UI --> DEXIE[(IndexedDB)] --> OUTBOX[outbox + sync engine] --> HTTP
  end
  shared --> api
  shared --> web
```

### Dependencias entre módulos

`WorkOrderCoreModule` concentra acceso, transiciones, consecutivos y mapeos sin
depender de otros módulos de negocio. Evidencias, firmas, checklist e informes lo
importan; `WorkOrdersModule` importa `ReportsModule` (la aprobación genera el PDF);
`SyncModule` orquesta comandos existentes. No hay dependencias circulares.

### Decisiones clave

- **Transiciones**: único punto (`WorkOrderTransitionsService.apply`) que cambia
  `status`, con `UPDATE … WHERE status = actual` como guardia de concurrencia,
  historial y auditoría en la misma transacción. Las OT se bloquean con
  `SELECT … FOR UPDATE` en cada comando.
- **Aprobación + PDF** en una transacción: si el PDF falla, la OT no cambia.
- **Formato de error común** `{ code, message, details, requestId }`; nunca se
  exponen mensajes de Prisma/PostgreSQL ni stack traces.
- **Observabilidad**: Pino JSON, `X-Request-Id` por request (propagado o generado),
  log con requestId, userId, método, ruta, estado y duración; credenciales y
  cookies redactadas. `/api/v1/health` (liveness) y `/api/v1/health/ready`
  (base de datos + storage).

## Frontend

- `ui/`: design system propio (Button, Input, Select, DataTable, StatusBadge,
  Panel, Modal, Drawer, Toast, Timeline, SignaturePad, EvidenceUploader,
  ChecklistField, WorkOrderCard, SyncIndicator…) sobre tokens CSS (`styles/tokens.css`).
- `layouts/`: `AdminLayout` (sidebar) y `MobileLayout` (barra inferior de 4 opciones).
- `features/`: una carpeta por módulo; carga diferida por ruta.
- `lib/offline/`: base Dexie, outbox, acciones locales, motor de sincronización,
  compresión de imágenes. Ver [offline-sync.md](./offline-sync.md).

## Extensión futura

La separación por módulos permite agregar (sin reescribir el núcleo) cotizaciones,
facturación/Siigo (consumiendo `WORK_ORDER_APPROVED`), portal de clientes (nuevo
frontend sobre la misma API y `ClientRef`), mantenimiento preventivo programado
(generador de OT sobre `ChecklistTemplate` + `Equipment`), códigos QR de equipos
(`Equipment.id`) y notificaciones (suscriptores de `AuditLog`).
