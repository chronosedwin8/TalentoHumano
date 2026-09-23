# Operacion

## Requisitos del servidor

Para hasta unos 500 colaboradores: 2 vCPU, 4 GB de RAM y 40 GB de disco, con
Docker y Docker Compose. El disco crece sobre todo por archivos subidos
(hojas de vida, soportes de incapacidad, evidencias), no por la base de datos.

## Primer despliegue

```bash
git clone https://github.com/chronosedwin8/TalentoHumano.git /opt/talento
cd /opt/talento
cp .env.example .env
```

Complete `.env`. Estas cuatro no pueden quedar con el valor de ejemplo:

```bash
# Genere cada una por separado:
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # COOKIE_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY  <- ver la advertencia de abajo
```

> **ENCRYPTION_KEY.** Con ella se cifran salarios, datos de salud, informacion
> bancaria, procesos disciplinarios y denuncias. Si se pierde, esos datos son
> **irrecuperables**: no hay forma de descifrarlos. Guardela en un gestor de
> secretos, **fuera** del servidor y **fuera** de los respaldos. Cambiarla exige
> descifrar y volver a cifrar todo.

Certificado y arranque:

```bash
docker compose -f infra/docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot -d talento.suempresa.com

./infra/scripts/deploy.sh
```

El script respalda, construye, migra, levanta y verifica el health check. Si la
API no responde, termina con error sin dejar el despliegue a medias.

Siembra inicial (solo la primera vez):

```bash
docker compose -f infra/docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

`seed.ts` crea catalogos base, los 308 permisos y los 11 roles del sistema.
**No ejecute `seed-demo.ts` en produccion:** crea una empresa de ejemplo con
datos ficticios.

## Despliegues siguientes

```bash
cd /opt/talento && git pull && ./infra/scripts/deploy.sh
```

O automaticamente: el flujo de CI despliega por SSH cuando `main` pasa todas las
pruebas y la variable `DEPLOY_ENABLED` esta en `true`.

## Respaldos

```bash
./infra/scripts/backup.sh
```

Produce tres archivos en `infra/backups/`: el volcado de la base, los archivos
subidos y las sumas de verificacion. Conserva 30 dias
(`BACKUP_RETENTION_DAYS`) y, si `BACKUP_S3_BUCKET` esta definido, copia fuera
del servidor.

Programelo a diario:

```cron
0 3 * * * cd /opt/talento && ./infra/scripts/backup.sh >> /var/log/talento-backup.log 2>&1
```

> Un respaldo en el mismo disco que la base de datos no es un respaldo. Defina
> `BACKUP_S3_BUCKET` o copie a otra maquina.

## Restauracion

```bash
./infra/scripts/restore.sh infra/backups/talento-scheduled-20260922-030000.dump
```

Verifica la suma de verificacion, pide confirmacion escrita, respalda el estado
actual antes de reemplazarlo, detiene la API, restaura, aplica migraciones
pendientes y vuelve a levantar.

> Los datos cifrados solo se leen con la **misma** `ENCRYPTION_KEY` con la que se
> guardaron. Restaurar en un servidor nuevo exige llevar esa llave.

**Pruebe la restauracion.** Un respaldo que nunca se restauro es una hipotesis.

## Vigilancia

```bash
curl -s https://talento.suempresa.com/health
```

```json
{ "status": "ok", "dependencies": { "database": "up", "queue": "bullmq" } }
```

Responde 503 si la base de datos no esta disponible. Es el endpoint que debe
vigilar un monitor externo.

Registros:

```bash
docker compose -f infra/docker-compose.prod.yml logs -f api
docker compose -f infra/docker-compose.prod.yml logs -f nginx
```

## Tareas periodicas

Estas operaciones se disparan por endpoint para que queden auditadas y bajo
control de quien las ejecuta:

| Endpoint | Para que | Sugerido |
|---|---|---|
| `POST /analytics/snapshots/run` | Foto diaria de indicadores | Diario |
| `POST /analytics/alerts/run` | Vencimientos y riesgo de rotacion | Diario |
| `POST /onboarding/reminders/run` | Recordatorios de tareas de ingreso | Diario |
| `POST /recruiting/retention/anonymize` | Anonimizar candidatos vencidos | Mensual |

## Escalar

La API es sin estado: se pueden correr varias replicas detras de nginx. Dos
condiciones:

1. `REDIS_ENABLED=true`, para que los trabajos no se dupliquen entre replicas.
2. `STORAGE_DRIVER=s3`, para que todas vean los mismos archivos.

## Problemas frecuentes

**La API no arranca y el log habla de la base de datos.** Verifique
`DATABASE_URL` y que el contenedor de PostgreSQL este sano:
`docker compose ps`.

**Todo responde 403 despues de cambiar roles.** La cache de permisos vive 60
segundos. Si persiste, revise que los comodines del rol se hayan expandido:
`GET /users/roles/all` muestra los permisos efectivos.

**Los datos cifrados se leen como `enc:v1:...`.** La `ENCRYPTION_KEY` no es la
misma con la que se guardaron.

**Se agotan los limites de tasa.** Ajuste `THROTTLE_LIMIT` y `THROTTLE_TTL` si
hay muchos usuarios tras una sola IP publica.

## Actualizar PostgreSQL

Las migraciones no cambian entre versiones menores. Para una version mayor,
respalde, cambie la imagen, levante con volumen vacio y restaure el volcado.
