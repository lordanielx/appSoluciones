# Supuestos y decisiones no bloqueantes

Decisiones tomadas donde el RFP es ambiguo. Cada una puede revisarse sin cambiar
la arquitectura.

## Repositorio

- **A-01** La raíz del repositorio (`appSoluciones`) hace las veces de
  `/mecaelectric-platform`. No se crea una carpeta adicional.
- **A-02** Los paquetes `types` y `validation` propuestos se unifican en
  `packages/shared` (`@meca/shared`): enums, tipos, esquemas Zod, máquina de
  estados y reglas de finalización. Separarlos no aportaba valor y duplicaba
  configuración de build.
- **A-03** Los componentes del design system viven en `apps/web/src/ui` y no en
  `packages/ui`: solo existe un consumidor (la PWA). Si aparece un segundo
  frontend (portal de clientes), se extraen a un paquete.

## Dominio

- **A-04** Numeración: `OT-AAAA-NNNNNN` e `INF-AAAA-NNNNNN`; el consecutivo
  reinicia cada año, calculado en `America/Bogota`. Se usa una tabla `Counter`
  con incremento atómico (`INSERT … ON CONFLICT … RETURNING`).
- **A-05** El checklist se **copia** a la OT al crearla (o al cambiar la plantilla
  mientras está en DRAFT). Editar una plantilla incrementa su `version` y no altera
  órdenes existentes.
- **A-06** Reasignación: una OT en `ASSIGNED` o `REJECTED` puede reasignarse
  (queda en `ASSIGNED`). Una OT `ACCEPTED` puede reasignarse por coordinación
  (vuelve a `ASSIGNED` con el nuevo técnico).
- **A-07** `CHANGES_REQUESTED → IN_PROGRESS` ocurre cuando el técnico pulsa
  "Retomar servicio"; también puede re-enviar directamente a `PENDING_REVIEW`.
- **A-08** Cancelación permitida desde cualquier estado anterior a `APPROVED`,
  con motivo obligatorio.
- **A-09** RB-014 (no modificar silenciosamente un informe aprobado): una OT
  `APPROVED` puede **reabrirse** para corrección (`APPROVED → CHANGES_REQUESTED`,
  comentario obligatorio). Al aprobar de nuevo se genera una nueva versión del
  informe y la anterior queda `SUPERSEDED`. También puede regenerarse el PDF
  (nueva versión) sin reabrir, por ejemplo tras corregir datos de la empresa
  representada. Ningún PDF aprobado se sobrescribe.
- **A-10** RB-008 (observaciones obligatorias) se implementa así:
  - cada ítem puede marcar `observationRequired`;
  - en ítems `STATUS`, la observación es obligatoria cuando el resultado es
    "Requiere intervención" o "Crítico";
  - las conclusiones técnicas de la OT (`technicianNotes`) son obligatorias para
    enviar a revisión.
- **A-11** RB-010 excepción de firma del cliente: la registra un Administrador o
  Coordinador con motivo obligatorio; queda auditada y visible en el informe
  ("Firma del cliente no capturada — excepción autorizada por …").
- **A-12** El rol Revisor se modela como permiso `WORK_ORDER_REVIEW` que tienen
  ADMINISTRADOR y COORDINADOR (RBAC por permisos, roles con conjuntos fijos).
- **A-13** Un usuario tiene un solo rol en el MVP.
- **A-14** Prioridades: `LOW, MEDIUM, HIGH, URGENT` (Baja, Media, Alta, Urgente).
- **A-15** Tipos de servicio: entidad configurable `ServiceType` (nombre, código,
  requiere equipo). RB-002 se valida con `requiresEquipment`.
- **A-16** Los técnicos se gestionan como usuarios con rol TÉCNICO (datos
  adicionales: teléfono, especialidad). No se crea una entidad separada.

## Seguridad

- **A-17** Access token JWT de 15 minutos en memoria; refresh token opaco de 14
  días en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, rotado
  en cada uso, guardado como hash SHA-256. Reutilizar un refresh token ya rotado
  revoca toda la familia de sesiones.
- **A-18** CSRF: como la cookie solo viaja a `/api/v1/auth` con `SameSite=Strict`
  y el resto de la API usa `Authorization: Bearer`, el riesgo CSRF queda acotado.
  Además `/auth/refresh` y `/auth/logout` exigen el encabezado
  `X-Requested-With: meca-web`.
- **A-19** Recuperación de contraseña: se genera un token de un solo uso (1 h).
  En el MVP no hay proveedor de correo configurado; el `MailService` registra el
  enlace en el log en desarrollo y queda preparado para SMTP (`SMTP_URL`). La
  respuesta del endpoint es siempre la misma exista o no el correo.
- **A-20** Bloqueo: 5 intentos fallidos consecutivos bloquean la cuenta 15 minutos.
- **A-21** Política de contraseña: mínimo 10 caracteres, con letras y números.

## Offline

- **A-22** Solo el técnico trabaja offline. La administración requiere conexión.
- **A-23** Los IDs de evidencias y firmas los genera el cliente (UUID v4); el
  servidor los usa como clave de idempotencia natural.
- **A-24** Si el técnico recarga la app sin conexión, se usa el último perfil
  autenticado guardado en IndexedDB para mostrar sus órdenes locales. Al cerrar
  sesión se borran los datos locales (si hay operaciones pendientes se advierte).
- **A-25** Conflictos: solo se detectan sobre respuestas de checklist y edición de
  la OT (campo `version`). Las transiciones de estado se protegen con la máquina
  de estados. Ante conflicto se muestra "Esta orden fue modificada desde otro
  dispositivo" y el técnico elige conservar su valor o el del servidor.

## Infraestructura

- **A-26** Storage: driver `s3` (MinIO/S3) o `local` (disco con URLs firmadas
  HMAC). `docker-compose` usa MinIO. El entorno de CI y el entorno sin Docker
  usan `local`.
- **A-27** El PDF se genera con el Chromium de Playwright. En Docker se usa la
  imagen oficial de Playwright. `PDF_CHROMIUM_PATH` permite usar un binario
  existente.
- **A-28** Zona horaria: se almacena UTC en base de datos; se presenta en
  `America/Bogota` en UI y PDF.
- **A-29** Zod es la única librería de validación (backend y frontend); el
  OpenAPI se genera desde los esquemas Zod (`z.toJSONSchema`).
