#!/usr/bin/env bash
# Deploys the current commit: build, migrate, restart, verify.
# Run from the repository root on the server.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/infra/docker-compose.prod.yml --env-file $ROOT/.env"
cd "$ROOT"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f .env ]] || fail "falta el archivo .env en la raiz del repositorio"

log "Construyendo las imagenes"
$COMPOSE build --pull

log "Levantando la base de datos y la cache"
$COMPOSE up -d postgres redis
$COMPOSE exec -T postgres sh -c 'until pg_isready -q; do sleep 1; done'

# A deploy that cannot be rolled back is not a deploy. On the very first
# deploy the database is empty and the dump is trivial, which is fine.
log "Respaldando la base de datos antes de migrar"
"$ROOT/infra/scripts/backup.sh" --tag "pre-deploy"

# Migrations run once, from a throwaway container, before any instance starts
# serving with the new schema.
log "Aplicando migraciones"
$COMPOSE run --rm --entrypoint sh api -c 'npx prisma migrate deploy'

log "Desplegando la API y la aplicacion web"
$COMPOSE up -d --remove-orphans

log "Verificando el estado del servicio"
for attempt in $(seq 1 30); do
  if $COMPOSE exec -T api node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    log "Despliegue completado"
    $COMPOSE ps
    exit 0
  fi
  sleep 2
done

fail "la API no respondio al health check; revise 'docker compose logs api'"
