#!/usr/bin/env sh
# Respaldo lógico de PostgreSQL con rotación. Uso:
#   DATABASE_URL=postgresql://... BACKUP_DIR=/backups KEEP_DAYS=14 ./backup-db.sh
# Programar diariamente (cron / tarea del proveedor). Los archivos de object storage
# se respaldan con la replicación/versionado del bucket (ver docs/deployment.md).
set -eu
: "${DATABASE_URL:?DATABASE_URL es obligatorio}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/mecaelectric-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"
echo "Respaldo creado: $FILE"
find "$BACKUP_DIR" -name 'mecaelectric-*.dump' -mtime +"$KEEP_DAYS" -delete
