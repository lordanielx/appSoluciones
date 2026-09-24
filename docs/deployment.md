# Despliegue

## Entornos

| Entorno | NODE_ENV (API) | Notas |
|---------|----------------|-------|
| development | development | `.env` local, MinIO o driver `local`, seed de demostración |
| staging | staging | Igual a producción con datos de prueba. Exige `COOKIE_SECURE=true` y secretos reales |
| production | production | HTTPS obligatorio; sin seed; Swagger UI deshabilitado |

## Con Docker Compose (demostración / servidor único)

```bash
cp .env.example .env              # ajustar secretos
docker compose up -d --build      # postgres, minio, minio-init, api, web
docker compose exec api npx prisma db seed   # solo si se quieren datos demo
```

- Web: http://localhost:8080 (nginx sirve la PWA y hace proxy de `/api`).
- API: http://localhost:3000/api/v1 (Swagger en `/api/v1/docs` fuera de producción).
- MinIO consola: http://localhost:9001.

La imagen de la API aplica `prisma migrate deploy` al arrancar (nunca
`synchronize`/`db push`). Se basa en `mcr.microsoft.com/playwright:v1.56.1-noble`
porque el PDF se genera con Chromium (ADR-006).

## Producción recomendada

```
Internet ─ TLS (Caddy/Nginx/ALB) ─┬─ web (nginx estático)
                                  └─ /api → api (1..n réplicas)
                                              ├─ PostgreSQL gestionado (backups PITR)
                                              └─ S3 / R2 / Spaces (bucket privado, versionado)
```

1. PostgreSQL 16 gestionado con backups automáticos y PITR.
2. Bucket S3 compatible privado con versionado; configurar `S3_PUBLIC_ENDPOINT`
   si difiere del interno y permitirlo en la CSP (`img-src`, `connect-src`) de
   `infra/nginx/web.conf`. CORS del bucket: `GET` desde el dominio de la app.
3. Variables: ver `.env.example`. Obligatorias: `DATABASE_URL`,
   `JWT_ACCESS_SECRET` (≥32, aleatorio), `COOKIE_SECURE=true`, `CORS_ORIGINS`,
   `APP_PUBLIC_URL`, `STORAGE_DRIVER=s3`, `S3_*`, `TRUST_PROXY` (1 detrás de proxy).
4. Migraciones: `pnpm db:deploy` (o el arranque del contenedor).
5. Health checks: liveness `GET /api/v1/health`, readiness `GET /api/v1/health/ready`.
6. Logs JSON por stdout (Pino) → agregador; correlación por `X-Request-Id`.
7. Varias réplicas de la API son seguras: consecutivos y transiciones se
   serializan en PostgreSQL; la API no guarda estado en memoria salvo el
   navegador Chromium reutilizable por proceso.

## Backups

- Base de datos: `infra/scripts/backup-db.sh` (pg_dump formato custom, rotación
  `KEEP_DAYS`) programado diariamente, además de los backups del proveedor.
  Restauración: `infra/scripts/restore-db.sh` sobre una base vacía. Probar la
  restauración al menos mensualmente.
- Archivos: versionado + replicación del bucket. Los PDF aprobados nunca se
  sobrescriben (claves únicas por versión con hash SHA-256 registrado en `Report`).

## Actualizaciones de la PWA

Nginx sirve `sw.js` y el manifiesto con `no-cache` y los assets con hash como
`immutable`. Al publicar una versión, el usuario ve "Hay una nueva versión" y
decide cuándo actualizar; los cambios offline pendientes se conservan en IndexedDB.

## CI

`.github/workflows/ci.yml`: install → lint → typecheck → pruebas unitarias e
integración (PostgreSQL de servicio + Chromium) → build; job E2E con Playwright.
