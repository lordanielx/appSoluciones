# Mecaelectric Operaciones

Plataforma interna (PWA) de Mecaelectric S.A.S. para gestionar servicios de
mantenimiento industrial de punta a punta:

```
Cliente → Orden de trabajo → Asignación → Técnico acepta → Ejecución → Checklist
→ Evidencias → Firmas → Revisión → Aprobación → Informe PDF versionado
```

- **Administración / coordinación** (escritorio): clientes, equipos, empresas
  representadas, tipos de servicio, plantillas de checklist, usuarios, órdenes,
  revisión y aprobación, dashboard y trazabilidad.
- **Técnico** (móvil, instalable): órdenes del día, aceptación, checklist paso a
  paso, fotos con la cámara, firmas del técnico y del cliente, envío a revisión.
  **Funciona sin conexión** y sincroniza después sin duplicar operaciones.

Stack: React 18 + Vite + Tailwind + TanStack Query + Dexie + Workbox · NestJS 11
+ Prisma 6 + PostgreSQL 16 · MinIO/S3 · Chromium (Playwright) para PDF · Zod
compartido · pnpm workspaces.

## Inicio rápido (desarrollo)

Requisitos: Node 22, pnpm 10, Docker (o PostgreSQL 16 local).

```bash
cp .env.example .env
docker compose up -d postgres minio minio-init
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:5173 (Vite hace proxy de `/api` a la API)
- API: http://localhost:3000/api/v1 · Swagger: http://localhost:3000/api/v1/docs
- MinIO consola: http://localhost:9001 (`mecaminio` / `mecaminio-dev-secret`)

Variaciones respecto al comando ideal del RFP:

- Se agrega el servicio `minio-init`, que crea el bucket privado `mecaelectric`.
- `pnpm db:migrate` ejecuta `prisma migrate dev` (crea la base si no existe y
  aplica migraciones). En staging/producción usar `pnpm db:deploy`.
- **Sin Docker**: con un PostgreSQL local basta ajustar `DATABASE_URL` y usar
  `STORAGE_DRIVER=local` (archivos en `apps/api/storage-data`, servidos con URLs
  firmadas HMAC por la API).
- La generación del PDF usa el Chromium de Playwright. Si no está instalado:
  `npx playwright install chromium` (o definir `PDF_CHROMIUM_PATH`).

### Usuarios de demostración (solo development)

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | admin@mecaelectric.local | `Mecaelectric2026` |
| Coordinador | coordinador@mecaelectric.local | `Mecaelectric2026` |
| Técnico | tecnico@mecaelectric.local | `Mecaelectric2026` |
| Técnico | tecnico2@mecaelectric.local | `Mecaelectric2026` |

El seed crea además las empresas MECAELECTRIC S.A.S. (principal) y Compresores
Antioquia (aliada), clientes Industrias Andinas S.A.S. y Alimentos del Norte
S.A.S., equipos MP-001 Compresor GA30, MP-002 Motor eléctrico 25 HP, MP-003
Bomba centrífuga, tipos de servicio y dos plantillas de checklist.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | API (watch) + web (Vite) + paquete compartido (watch) |
| `pnpm build` | Build de todos los paquetes (PWA con service worker) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript strict en todo el monorepo |
| `pnpm test` | Unitarias (shared, web) + unitarias e integración de la API (requiere PostgreSQL; base `mecaelectric_test`) |
| `pnpm test:e2e` | Playwright: flujo completo y escenario offline contra el build de producción (base `mecaelectric_e2e`) |
| `pnpm db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Migraciones y datos demo |
| `pnpm --filter @meca/api openapi` | Exporta `docs/openapi.json` |
| `docker compose up -d --build` | Stack completo: http://localhost:8080 |

Las pruebas de integración usan `TEST_DATABASE_URL`
(por defecto `postgresql://meca:meca@localhost:5432/mecaelectric_test`) y las E2E
`E2E_DATABASE_URL` (por defecto `…/mecaelectric_e2e`). El `docker compose` de
desarrollo crea ambas bases automáticamente.

## Estructura

```
apps/api            NestJS: módulos auth, users, clients, equipment, brand-profiles,
                    service-types, checklist-templates, work-orders, checklist-execution,
                    evidence, signatures, reports, sync, audit, storage, health
apps/web            PWA React: ui/ (design system), layouts/, features/, lib/offline/
packages/shared     Enums, máquina de estados, RBAC, reglas RB-006..010, Zod, DTOs
packages/tsconfig   Configuración TypeScript base
packages/eslint-config
e2e/                Playwright (full-flow, offline)
infra/              docker-compose, nginx, scripts de backup
docs/               Arquitectura, ERD, flujos, offline, seguridad, despliegue, ADRs, OpenAPI
```

## Documentación

- [Plan de implementación](docs/implementation-plan.md) · [Supuestos](docs/ASSUMPTIONS.md)
- [Arquitectura (C4)](docs/architecture.md) · [ERD](docs/erd.md) · [API](docs/api.md) · [OpenAPI](docs/openapi.json)
- [Flujo de OT y máquina de estados](docs/work-order-flow.md)
- [Offline y sincronización](docs/offline-sync.md)
- [Seguridad](docs/security.md) · [Despliegue](docs/deployment.md)
- ADRs: [001](docs/decisions/ADR-001-modular-monolith.md) · [002](docs/decisions/ADR-002-postgresql.md) · [003](docs/decisions/ADR-003-pwa-instead-of-native.md) · [004](docs/decisions/ADR-004-indexeddb-offline.md) · [005](docs/decisions/ADR-005-object-storage.md) · [006](docs/decisions/ADR-006-pdf-server-side.md) · [007](docs/decisions/ADR-007-rbac.md)
