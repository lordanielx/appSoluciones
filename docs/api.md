# API REST v1

- Base: `/api/v1`. Especificación completa OpenAPI 3: [`openapi.json`](./openapi.json)
  (regenerar con `pnpm --filter @meca/api openapi`) y Swagger UI en
  `http://localhost:3000/api/v1/docs` (fuera de producción).
- Los esquemas de entrada se generan desde los esquemas Zod compartidos
  (`packages/shared/src/schemas`), los mismos que valida el frontend.
- Autenticación: `Authorization: Bearer <accessToken>`.

## Formato de error

```json
{
  "code": "WORK_ORDER_INVALID_STATE",
  "message": "La orden debe estar aceptada antes de iniciar el servicio.",
  "details": { "action": "START", "currentStatus": "ASSIGNED" },
  "requestId": "0f6c…"
}
```

| HTTP | code | Uso |
|------|------|-----|
| 400 | VALIDATION_ERROR | `details.fields` por campo |
| 401 | UNAUTHENTICATED, INVALID_CREDENTIALS, SESSION_EXPIRED | |
| 403 | FORBIDDEN, ACCOUNT_DISABLED | permisos insuficientes |
| 404 | NOT_FOUND | también para recursos sin acceso |
| 409 | WORK_ORDER_INVALID_STATE, WORK_ORDER_NOT_EDITABLE, VERSION_CONFLICT, DUPLICATE | |
| 422 | WORK_ORDER_INCOMPLETE (`details.issues`), WORK_ORDER_REQUIRES_EQUIPMENT/TECHNICIAN | reglas de negocio |
| 423 | ACCOUNT_LOCKED | |
| 429 | RATE_LIMITED | |
| 503 | REPORT_GENERATION_FAILED | la OT no se modifica |

## Endpoints

| Grupo | Endpoints |
|-------|-----------|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` |
| Usuarios | `GET/POST /users` · `GET/PATCH /users/:id` · `PATCH /users/:id/status` · `GET /users/technicians` |
| Clientes | `GET/POST /clients` · `GET/PATCH /clients/:id` · `GET /clients/:id/equipment` · `GET /clients/:id/work-orders` |
| Equipos | `GET/POST /equipment` · `GET/PATCH /equipment/:id` · `POST /equipment/:id/photo` |
| Empresas | `GET/POST /brand-profiles` · `GET/PATCH /brand-profiles/:id` · `POST /brand-profiles/:id/logo` |
| Tipos de servicio | `GET/POST /service-types` · `PATCH /service-types/:id` |
| Checklists | `GET/POST /checklist-templates` · `GET/PATCH /checklist-templates/:id` |
| OT | `GET/POST /work-orders` · `GET/PATCH /work-orders/:id` · `GET /work-orders/:id/bundle` · `POST /work-orders/:id/{assign,accept,reject,start,submit,request-changes,approve,close,cancel,client-signature-waiver}` · `PATCH /work-orders/:id/technician-notes` |
| Ejecución | `GET /work-orders/:id/checklist` · `PATCH /work-orders/:id/checklist/responses/:responseId` |
| Evidencias | `GET/POST /work-orders/:id/evidence` · `DELETE /work-orders/:id/evidence/:evidenceId` (lógico) |
| Firmas | `GET/POST /work-orders/:id/signatures` |
| Informes | `POST /work-orders/:id/reports/generate` · `GET /work-orders/:id/reports` · `GET /work-orders/:id/report-preview` · `GET /reports/:id` · `GET /reports/:id/pdf` |
| Sync | `GET /sync/pull` · `POST /sync/batch` |
| Auditoría | `GET /work-orders/:id/history` · `GET /work-orders/:id/status-history` · `GET /audit-logs` |
| Dashboard | `GET /dashboard` |
| Salud | `GET /health` · `GET /health/ready` |

### Ejemplo: `POST /sync/batch`

```json
{
  "operations": [
    { "clientOperationId": "5b0e…", "type": "WORK_ORDER_START", "workOrderId": "…", "payload": {}, "createdAt": "2026-09-24T13:02:11.000Z" },
    { "clientOperationId": "9a1c…", "type": "CHECKLIST_RESPONSE_UPDATE", "workOrderId": "…", "entityId": "<responseId>",
      "payload": { "value": "GOOD", "observation": null, "baseVersion": 1 }, "createdAt": "…" }
  ]
}
```

Respuesta: `{ "results": [{ "clientOperationId": "5b0e…", "status": "APPLIED", "data": { "status": "IN_PROGRESS" } }, …] }`
con `status` ∈ `APPLIED | DUPLICATE | CONFLICT | REJECTED`.
