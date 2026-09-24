# Seguridad

Referencia: OWASP Top 10 2021 y OWASP API Security Top 10. El backend es la fuente
de verdad: el frontend solo adapta la interfaz.

## Autenticación (§32)

| Control | Implementación |
|---------|----------------|
| Contraseñas | Argon2id (m=19 MiB, t=2, p=1). Política: ≥10 caracteres con letras y números (`passwordSchema` compartido) |
| Sesión | Access token JWT HS256 de 15 min (iss/aud verificados) **en memoria**; refresh token opaco de 48 bytes, 14 días |
| Refresh cookie | `meca_rt`, `HttpOnly`, `Secure` (obligatorio en staging/producción), `SameSite=Strict`, `Path=/api/v1/auth` |
| Rotación | Cada refresh emite token nuevo y revoca el anterior (hash SHA-256 en BD). Reutilización fuera de la ventana de gracia de 20 s revoca toda la familia y se audita `AUTH_REFRESH_REUSE_DETECTED` |
| Fuerza bruta | 5 intentos fallidos → bloqueo 15 min (`423 ACCOUNT_LOCKED`); rate limit por IP en login, refresh y recuperación (`AUTH_RATE_LIMIT_PER_MINUTE`); 600 req/min global |
| Enumeración | Mismo mensaje y tiempo (hash ficticio) si el usuario no existe; recuperación responde siempre igual |
| Recuperación | Token de un solo uso, 60 min, almacenado como hash; al usarlo se cierran todas las sesiones |
| Desactivación | El guard consulta el usuario en cada request: desactivar corta el acceso de inmediato y revoca sesiones |

## Autorización (§33)

RBAC por permisos (`packages/shared/src/permissions.ts`), validado por
`PermissionsGuard` en cada endpoint y por `WorkOrderPolicy` por recurso:

- Técnico: solo OT asignadas a él y fuera de DRAFT (el filtro se aplica **en la
  consulta**, no después). Una OT ajena responde 404 para no revelar su existencia.
- Solo el técnico asignado ejecuta acciones de campo y solo en IN_PROGRESS /
  CHANGES_REQUESTED.
- Notas internas de la OT no se envían al técnico.
- Informes y archivos: acceso verificado por la OT antes de firmar URLs.

## Entrada y salida

- Validación Zod en todos los endpoints (body, query, multipart); tipos, longitudes
  y enums estrictos. UUID en parámetros (`ParseUUIDPipe`).
- Archivos: límite 15 MB, un archivo por request, validación por contenido real
  (sharp) — nunca por extensión o MIME declarado —, re-codificación completa
  (elimina EXIF/metadatos y payloads embebidos), nombres de objeto aleatorios.
- SVG de firmas generados en el servidor a partir de coordenadas numéricas
  (no se acepta SVG del cliente → sin XSS almacenado).
- PDF: HTML con escape de todo contenido de usuario; Chromium con JavaScript
  deshabilitado y red bloqueada (solo `data:`).
- Errores con formato común; sin mensajes internos de Prisma/PostgreSQL ni stack traces.
- Logs Pino con redacción de `authorization`, `cookie`, `set-cookie`, `password`, `token`.

## Cabeceras y transporte

- API: Helmet con CSP `default-src 'none'`, `frame-ancestors 'self'`, HSTS en
  producción, `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, sin `X-Powered-By`.
- Web (nginx): CSP `default-src 'self'`, `script-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`, `Permissions-Policy` (cámara solo propia).
- CORS restringido a `CORS_ORIGINS`, con credenciales.
- CSRF: la cookie solo viaja a `/api/v1/auth` con `SameSite=Strict`, y `/refresh`
  y `/logout` exigen `X-Requested-With: meca-web`. El resto de la API usa Bearer.
- HTTPS obligatorio en staging/producción (terminación TLS en el proxy);
  `TRUST_PROXY` para IP real.

## Storage

- Bucket privado (sin acceso anónimo). Descarga solo con URL firmada de 15 min
  (S3 presigned o HMAC-SHA256 con expiración en el driver local; comparación en
  tiempo constante y protección contra path traversal).
- Claves: `evidence/AAAA/MM/<workOrderId>/<uuid>.jpg`, `signatures/…`, `reports/…-vN.pdf`, `branding/…`.

## Datos del dispositivo

IndexedDB guarda datos operativos de las OT activas del técnico (nunca tokens).
Se borran al cerrar sesión. Riesgo residual: un teléfono desbloqueado y extraviado
expone las OT descargadas; mitigación: bloqueo del dispositivo (política MDM) y
expiración del refresh a 14 días.

## Auditoría

`AuditLog` inmutable (sin endpoint de borrado) con actor, acción, entidad,
metadatos, IP, user agent y requestId, escrito en la misma transacción que la
acción. Consultable en `GET /api/v1/audit-logs` (ADMIN/COORDINADOR) y por OT.

## Secretos

Solo por variables de entorno (`.env` fuera del repositorio). La API se niega a
arrancar en staging/producción con `JWT_ACCESS_SECRET` de ejemplo o sin
`COOKIE_SECURE=true`. Las contraseñas del seed son solo para desarrollo y el seed
se niega a correr con `NODE_ENV=production`.

## Pendientes conocidos

- Proveedor SMTP real para recuperación de contraseña (hoy: log en desarrollo).
- 2FA para administradores (fuera del MVP).
- Antivirus sobre cargas (mitigado por re-codificación de imágenes).
