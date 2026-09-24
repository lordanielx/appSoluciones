# Plan de implementación — Mecaelectric Operaciones (MVP 1.0)

Este documento resume el análisis del RFP y la secuencia de construcción. Las
decisiones que no estaban definidas en el RFP están en [ASSUMPTIONS.md](./ASSUMPTIONS.md)
y las decisiones de arquitectura en [decisions/](./decisions).

## 1. Lectura del RFP

El problema real no es "tener pantallas", sino eliminar la reconstrucción manual
del informe técnico: hoy la información del servicio viaja por WhatsApp, papel,
Word y Excel, y una persona administrativa la re-digita. El MVP debe lograr que el
técnico capture la información **una sola vez**, en el sitio, incluso sin señal, y
que el informe PDF salga del sistema sin intervención manual.

Flujo crítico (definición de "terminado", sección 66):

```
Cliente → Equipo → OT (DRAFT) → Asignación (ASSIGNED) → Aceptación (ACCEPTED)
→ Ejecución (IN_PROGRESS) → Checklist + Evidencias + Firmas → Envío (PENDING_REVIEW)
→ Revisión (APPROVED | CHANGES_REQUESTED) → PDF versionado almacenado → CLOSED
```

## 2. Arquitectura elegida

- **Monolito modular** (NestJS) con módulos `auth, users, clients, equipment,
  brand-profiles, checklist-templates, work-orders, checklist-execution, evidence,
  signatures, reports, audit, sync, storage, health`.
- **PostgreSQL 16 + Prisma** con migraciones versionadas.
- **Object storage** detrás de una interfaz `StorageDriver`: S3/MinIO en
  despliegue, sistema de archivos local con URLs firmadas HMAC como alternativa de
  desarrollo/CI.
- **PWA React + Vite** con dos experiencias: escritorio (administración) y móvil
  (técnico). Datos del técnico en IndexedDB (Dexie) con patrón *outbox*.
- **Paquete compartido `@meca/shared`**: enums, máquina de estados, reglas de
  finalización, permisos RBAC, esquemas Zod. Lo usan API y web, de modo que las
  reglas de negocio se escriben una vez y el backend sigue siendo la fuente de
  verdad.
- **PDF server-side** con plantilla HTML/CSS y Chromium (Playwright).

## 3. Estructura del repositorio

```
apps/api          NestJS + Prisma
apps/web          React PWA
packages/shared   dominio compartido (enums, state machine, zod, reglas)
packages/tsconfig configuraciones base de TypeScript
packages/eslint-config
infra/            docker-compose, nginx, scripts
e2e/              Playwright (flujo completo + offline)
docs/             arquitectura, ERD, flujos, seguridad, ADRs
```

## 4. Iteraciones

| # | Alcance | Verificación |
|---|---------|--------------|
| 0 | Monorepo, tsconfig, lint, Prisma, docker-compose, CI | `pnpm lint typecheck test build` |
| 1 | Auth (login, refresh rotativo, logout, recuperación), usuarios, RBAC, shell UI | tests de integración auth |
| 2 | Clientes, equipos, empresas representadas | integración CRUD |
| 3 | Plantillas de checklist configurables | unit + integración |
| 4 | OT, numeración, máquina de estados, asignación, historial | unit state machine + integración |
| 5 | Experiencia técnico (móvil) | E2E |
| 6 | Evidencias (compresión, thumbnails, storage), offline + outbox + sync idempotente | unit + E2E offline |
| 7 | Firmas (canvas → SVG + PNG) | integración |
| 8 | Revisión, solicitud de correcciones, aprobación, PDF versionado | integración + E2E |
| 9 | Auditoría, dashboard, hardening (helmet, CSP, rate limit, bloqueo) | integración |
| 10 | E2E completo, responsive 360–1440, documentación | Playwright |

## 5. Riesgos identificados

- **Offline + autenticación**: el access token vive en memoria. Si el técnico
  recarga la app sin conexión se usa el perfil cacheado para trabajar localmente y
  la sincronización espera a que el refresh token (cookie HttpOnly) pueda
  renovarse con conexión. Ver `docs/offline-sync.md`.
- **Tamaño de fotografías**: compresión en cliente (1920 px, JPEG ~0.82) y
  re-procesamiento en servidor (sharp) para garantizar orientación, eliminación
  de EXIF y thumbnails consistentes.
- **Modificación de plantillas en uso**: el checklist se copia (snapshot) a la OT
  al crearla; editar la plantilla no altera órdenes existentes.
