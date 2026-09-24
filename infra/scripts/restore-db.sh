#!/usr/bin/env sh
# Restaura un respaldo sobre una base VACÍA (nunca sobre producción en uso). Uso:
#   DATABASE_URL=postgresql://... ./restore-db.sh backups/mecaelectric-20260924T030000Z.dump
set -eu
: "${DATABASE_URL:?DATABASE_URL es obligatorio}"
: "${1:?Indique el archivo .dump}"
pg_restore --no-owner --exit-on-error --dbname="$DATABASE_URL" "$1"
echo "Restauración completada desde $1"
