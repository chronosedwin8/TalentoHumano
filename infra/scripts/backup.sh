#!/usr/bin/env bash
# Dumps the database and the uploaded files, then prunes old copies.
#
# The encryption key is NOT included on purpose: a backup that carries both the
# ciphertext and its key protects nothing. Keep ENCRYPTION_KEY in your secret
# manager, and remember that without it a restored dump is unreadable.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/infra/docker-compose.prod.yml --env-file $ROOT/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/infra/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TAG="scheduled"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    *) echo "opcion desconocida: $1" >&2; exit 2 ;;
  esac
done

# shellcheck disable=SC1091
set -a; source "$ROOT/.env"; set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="talento-${TAG}-${STAMP}"
mkdir -p "$BACKUP_DIR"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

log "Volcando la base de datos"
$COMPOSE exec -T postgres pg_dump \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB:-talento}" \
  --format=custom --compress=9 \
  > "$BACKUP_DIR/${NAME}.dump"

# The uploads live in the API container; on the first deploy (or with the
# API stopped) there is nothing to archive yet.
FILES=("${NAME}.dump")
if $COMPOSE ps --status running --services 2>/dev/null | grep -qx api; then
  log "Empaquetando los archivos subidos"
  $COMPOSE exec -T api tar -cf - -C /app/apps/api storage \
    | gzip -9 > "$BACKUP_DIR/${NAME}-storage.tar.gz"
  FILES+=("${NAME}-storage.tar.gz")
else
  log "La API no esta en ejecucion: se omiten los archivos subidos"
fi

# A checksum turns "the file exists" into "the file is intact".
log "Calculando sumas de verificacion"
( cd "$BACKUP_DIR" && sha256sum "${FILES[@]}" > "${NAME}.sha256" )

SIZE="$(du -ch "$BACKUP_DIR/${NAME}"* 2>/dev/null | tail -1 | cut -f1)"
log "Respaldo ${NAME} listo (${SIZE})"

log "Eliminando respaldos con mas de ${RETENTION_DAYS} dias"
find "$BACKUP_DIR" -name 'talento-*' -type f -mtime "+${RETENTION_DAYS}" -print -delete

# Optional off-site copy: a backup on the same disk as the database is not one.
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  log "Copiando a ${BACKUP_S3_BUCKET}"
  aws s3 cp "$BACKUP_DIR/${NAME}.dump" "s3://${BACKUP_S3_BUCKET}/${NAME}.dump"
  if [[ -f "$BACKUP_DIR/${NAME}-storage.tar.gz" ]]; then
    aws s3 cp "$BACKUP_DIR/${NAME}-storage.tar.gz" "s3://${BACKUP_S3_BUCKET}/${NAME}-storage.tar.gz"
  fi
  aws s3 cp "$BACKUP_DIR/${NAME}.sha256" "s3://${BACKUP_S3_BUCKET}/${NAME}.sha256"
fi
