# Modelo de datos (ERD)

Fuente de verdad: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)
y sus migraciones. IDs internos UUID; números legibles `OT-AAAA-NNNNNN` e
`INF-AAAA-NNNNNN` para humanos.

```mermaid
erDiagram
  User ||--o{ Session : "refresh tokens"
  User ||--o{ PasswordResetToken : ""
  User ||--o{ WorkOrder : "técnico asignado"
  User ||--o{ WorkOrder : "creada por"
  User ||--o{ AuditLog : "actor"
  Client ||--o{ Equipment : ""
  Client ||--o{ WorkOrder : ""
  Equipment |o--o{ WorkOrder : ""
  BrandProfile ||--o{ WorkOrder : "empresa representada"
  BrandProfile ||--o{ Report : "marca usada"
  ServiceType ||--o{ WorkOrder : ""
  ServiceType |o--o{ ChecklistTemplate : ""
  ChecklistTemplate ||--o{ ChecklistTemplateItem : ""
  ChecklistTemplate ||--o{ WorkOrder : ""
  WorkOrder ||--|| ChecklistExecution : "copia del checklist"
  ChecklistExecution ||--o{ ChecklistResponse : ""
  ChecklistResponse |o--o{ Evidence : ""
  WorkOrder ||--o{ Evidence : ""
  WorkOrder ||--o{ Signature : ""
  WorkOrder ||--o{ Report : "versiones"
  WorkOrder ||--o{ WorkOrderStatusHistory : ""
  User ||--o{ ProcessedOperation : "idempotencia offline"

  User {
    uuid id PK
    string email UK
    string fullName
    Role role
    string passwordHash
    bool active
    int failedLoginCount
    datetime lockedUntil
  }
  Client {
    uuid id PK
    string legalName
    string nit UK
    string dv
    bool active
  }
  Equipment {
    uuid id PK
    uuid clientId FK
    string code "UK(clientId,code)"
    string serial
    string photoKey
    bool active
  }
  BrandProfile {
    uuid id PK
    string name
    string legalName
    string nit
    string logoKey
    string primaryColor
    string secondaryColor
    bool isDefault
    bool active
  }
  ChecklistTemplate {
    uuid id PK
    string name
    int version
    bool active
  }
  ChecklistTemplateItem {
    uuid id PK
    int order
    string section
    string label
    ResponseType responseType
    bool required
    bool evidenceRequired
    int minPhotos
    bool observationRequired
    string_arr options
    float minValue
    float maxValue
    datetime archivedAt
  }
  WorkOrder {
    uuid id PK
    string number UK
    WorkOrderStatus status
    Priority priority
    datetime scheduledStart
    uuid assignedTechnicianId FK
    int version
    bool clientSignatureWaived
  }
  ChecklistResponse {
    uuid id PK
    string label
    ResponseType responseType
    json value
    string observation
    int version
  }
  Evidence {
    uuid id PK "generado en el dispositivo"
    string fileKey
    string thumbnailKey
    datetime capturedAt
    SyncStatus syncStatus
    datetime deletedAt
  }
  Signature {
    uuid id PK
    SignatureType signatureType
    string signerName
    string signerRole
    string svgKey
    string pngKey
    datetime signedAt
    bool consentAccepted
    datetime supersededAt
  }
  Report {
    uuid id PK
    string reportNumber
    int version "UK(workOrderId,version)"
    ReportStatus status
    string pdfKey
    string sha256
  }
  AuditLog {
    uuid id PK
    uuid actorId
    string action
    string entityType
    string entityId
    uuid workOrderId
    json metadata
    string ip
    string requestId
  }
  Counter {
    string key PK "OT-2026"
    int value
  }
  ProcessedOperation {
    uuid clientOperationId PK
    uuid userId
    string type
    json response
  }
```

## Índices (§54)

| Tabla | Índice |
|-------|--------|
| WorkOrder | `number` (único), `status`, `assignedTechnicianId`, `clientId`, `equipmentId`, `scheduledStart`, `createdAt` |
| Equipment | `clientId`, `serial`, único `(clientId, code)` |
| AuditLog | `entityId`, `(workOrderId, createdAt)`, `createdAt`, `actorId` |
| ChecklistResponse | `(executionId, order)` |
| Evidence | `workOrderId`, `checklistResponseId` |

## Borrado

No hay hard delete de OT, informes, evidencias, firmas ni auditoría (RB-016):

- Evidencias: `deletedAt` / `deletedById` (retiro lógico).
- Firmas: una nueva firma del mismo tipo marca la anterior con `supersededAt`.
- Informes: nuevas versiones marcan las anteriores `SUPERSEDED`.
- Configuración (clientes, equipos, marcas, tipos, plantillas, usuarios): `active`.
- Ítems de plantilla retirados: `archivedAt` (las OT conservan su copia).
