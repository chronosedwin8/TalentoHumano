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
openssl rand -hex 32   # JWT_ACCESS_SECRET
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

## Cuenta de administracion

La semilla base crea `superadmin@talento.local` (contrasena en
`SEED_SUPERADMIN_PASSWORD`). Para dar acceso total a una persona real, sin
tocar la base a mano:

```bash
pnpm --filter @talento/api run admin:create -- \
  --email ana@empresa.com --password 'UnaClaveLarga!' --name "Ana Perez"
```

El comando crea o promueve la cuenta como superadministradora y la hace
administradora de todas las empresas activas; la que tiene mas colaboradores
queda como empresa inicial. La contrasena no se guarda en ningun archivo: solo
su hash. Ejecutarlo de nuevo con el mismo correo actualiza nombre y clave.

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

La API trae su propio planificador (`SchedulerService`). Cada trabajo toma un
candado consultivo de PostgreSQL, asi que con varias replicas lo corre una
sola. Horas en UTC (07:00 UTC son las 02:00 en Bogota):

| Trabajo | Cuando | Que hace |
|---|---|---|
| `analytics.daily` | 07:00 | Snapshot de indicadores, alertas de vencimiento y riesgo de rotacion |
| `onboarding.reminders` | 12:00 | Recordatorios de tareas y escalamiento a Talento Humano de las vencidas |
| `workflows.sla` | cada hora | Recordatorio al aprobador y luego escalamiento al usuario configurado |
| `ethics.sla` | 12:30 | Aviso a los oficiales de etica de denuncias fuera de plazo |
| `reports.schedules` | cada 15 min | Reportes programados que ya vencieron (CSV por correo) |
| `recruiting.retention` | dia 1, 08:00 | Anonimizacion de candidatos con retencion vencida |

Las mismas operaciones siguen disponibles por endpoint para ejecutarlas a
mano y que queden auditadas con su actor:

| Endpoint | Para que |
|---|---|
| `POST /analytics/snapshots/run` | Foto diaria de indicadores |
| `POST /analytics/alerts/run` | Vencimientos y riesgo de rotacion |
| `POST /onboarding/reminders/run` | Recordatorios y escalamiento de tareas de ingreso |
| `POST /recruiting/retention/anonymize` | Anonimizar candidatos vencidos |

## Escalar

La API es sin estado: se pueden correr varias replicas detras de nginx. Dos
condiciones:

1. `REDIS_ENABLED=true`, para que los trabajos no se dupliquen entre replicas.
2. `STORAGE_DRIVER=s3`, para que todas vean los mismos archivos.

Por defecto cada replica de la API tambien consume las colas. Para separar
los consumidores, arranque las replicas con `QUEUE_WORKERS=false` y corra
uno o mas contenedores con `node dist/worker.js` (misma imagen, mismo `.env`).
La API exige en produccion (`NODE_ENV=production`) que `COOKIE_SECURE=true` y
que ningun secreto conserve el valor de ejemplo; si no, no arranca y el log
indica cual falta.

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
