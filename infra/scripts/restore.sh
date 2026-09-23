#!/usr/bin/env bash
# Restores a dump produced by backup.sh.
#
#   ./infra/scripts/restore.sh infra/backups/talento-scheduled-20260922-030000.dump
#
# This REPLACES the current database. It asks for confirmation and takes a
# safety copy first, so a wrong restore is still recoverable.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/infra/docker-compose.prod.yml --env-file $ROOT/.env"

DUMP="${1:-}"
[[ -n "$DUMP" ]] || { echo "uso: restore.sh <archivo.dump> [--yes]" >&2; exit 2; }
[[ -f "$DUMP" ]] || { echo "no existe el archivo $DUMP" >&2; exit 2; }
ASSUME_YES="${2:-}"

# shellcheck disable=SC1091
set -a; source "$ROOT/.env"; set +a

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# Verify the checksum when the backup shipped one.
SUMS="${DUMP%.dump}.sha256"
if [[ -f "$SUMS" ]]; then
  log "Verificando la integridad del archivo"
  ( cd "$(dirname "$DUMP")" && sha256sum --check --ignore-missing "$(basename "$SUMS")" )
fi

if [[ "$ASSUME_YES" != "--yes" ]]; then
  echo
  echo "Se va a REEMPLAZAR la base de datos '${POSTGRES_DB:-talento}' con:"
  echo "  $DUMP"
  read -r -p "Escriba 'restaurar' para continuar: " answer
  [[ "$answer" == "restaurar" ]] || { echo "Cancelado."; exit 1; }
fi

log "Tomando un respaldo de seguridad del estado actual"
"$ROOT/infra/scripts/backup.sh" --tag "pre-restore"

# Stopping the API avoids writes landing while the schema is being replaced.
log "Deteniendo la API"
$COMPOSE stop api

log "Restaurando el volcado"
$COMPOSE exec -T postgres pg_restore \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB:-talento}" \
  --clean --if-exists --no-owner --single-transaction \
  < "$DUMP"

# The dump may predate the current code.
log "Aplicando migraciones pendientes"
$COMPOSE run --rm --entrypoint sh api -c 'npx prisma migrate deploy'

STORAGE="${DUMP%.dump}-storage.tar.gz"
if [[ -f "$STORAGE" ]]; then
  log "Restaurando los archivos subidos"
  gunzip -c "$STORAGE" | $COMPOSE exec -T api tar -xf - -C /app/apps/api
fi

log "Levantando la API"
$COMPOSE up -d api

log "Restauracion completada. Recuerde que los datos cifrados solo se leen con la ENCRYPTION_KEY original."
