# Pruebas de carga (k6)

Pruebas de carga basicas contra la API de TALENTO. Son dos escenarios:

| Archivo | Que mide | VUs |
| --- | --- | --- |
| `listados.js` | Listados paginados: colaboradores, ausencias, candidatos y tickets. Solo lectura. | ~20 |
| `marcacion.js` | Marcacion de asistencia (`POST /time/clock`) y consulta del dia. **Escribe en la base de datos.** | ~10 |

---

## ⚠️ Advertencia: estas pruebas escriben en la base de datos

`marcacion.js` **inserta filas reales** en `time_clock_entry` y recalcula el dia de
asistencia (`attendance_day`) del colaborador con el que se autentica. Ademas deja
registros de auditoria y eventos de dominio.

**Nunca apunte estas pruebas a produccion ni a ningun entorno con datos reales.**
Uselas solo contra una base local o un entorno de demo desechable, sembrado con
`pnpm --filter @talento/api seed:demo`. Si necesita limpiar despues de una corrida,
vuelva a sembrar la base demo.

`listados.js` es de solo lectura, pero igual genera carga sostenida sobre la base:
tampoco debe ejecutarse contra produccion.

---

## Instalacion de k6

k6 no se instala con `pnpm`: es un binario independiente.

**Windows (winget):**

```powershell
winget install k6 --source winget
```

**Windows (Chocolatey):**

```powershell
choco install k6
```

**macOS:**

```bash
brew install k6
```

**Linux (Debian/Ubuntu):**

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Verifique con:

```bash
k6 version
```

---

## Antes de correr: suba el limite de peticiones

La API aplica un limite global por IP (`ThrottlerGuard`), configurado con
`THROTTLE_LIMIT` (300 peticiones por minuto por defecto) y `THROTTLE_TTL`.

Todos los VUs de k6 salen de **una sola IP**, asi que con el valor por defecto la
prueba se queda sin cupo en segundos y lo unico que mide es el limitador de tasa,
no la API. Antes de correr, en el `.env` del entorno local:

```
THROTTLE_LIMIT=100000
THROTTLE_TTL=60
```

y reinicie la API. Ambos scripts tienen un umbral `respuestas_429: rate==0`
precisamente para que, si olvida este paso, la corrida falle con un motivo claro
en lugar de devolver numeros sin sentido.

Recuerde devolver `THROTTLE_LIMIT` a su valor normal cuando termine.

---

## Ejecucion

Con la API corriendo en `http://localhost:3000` y la base demo sembrada:

```bash
# Listados (solo lectura, ~2 minutos)
k6 run infra/load/listados.js

# Marcacion (ESCRIBE en la base, ~100 segundos)
k6 run infra/load/marcacion.js
```

### Variables de entorno

Todas son opcionales; los valores por defecto apuntan al entorno local de demo.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | Raiz de la API (sin `/api/v1`). |
| `DEMO_PASSWORD` | `Demo1234!` | Contrasena de las cuentas demo. |
| `LOAD_USER` | `hr@demo.com` (listados) / `empleado@demo.com` (marcacion) | Cuenta con la que se autentica la prueba. |

Ejemplo apuntando a otro host:

```bash
k6 run -e BASE_URL=http://192.168.1.50:3000 -e DEMO_PASSWORD='Demo1234!' infra/load/listados.js
```

### Por que cada cuenta

- `listados.js` usa **`hr@demo.com`** (rol `hr_admin`): es la unica cuenta demo cuyos
  permisos cubren a la vez `people.*`, `leaves.*`, `recruiting.*` y `helpdesk.*` con
  alcance de empresa. Con un colaborador, los listados devolverian solo sus propias
  filas y la medicion no reflejaria el costo real de la consulta.
- `marcacion.js` usa **`empleado@demo.com`** (rol `employee`): `POST /time/clock` marca
  al colaborador autenticado y rechaza a los usuarios que no estan vinculados a un
  colaborador.

Ambos scripts inician sesion **una sola vez** en `setup()` y comparten el token entre
todos los VUs: `POST /auth/login` esta limitado a 60 peticiones por minuto por IP y el
hash de la contrasena es lento a proposito, asi que autenticarse en cada iteracion
romperia la corrida y, ademas, mediria el hash en lugar del endpoint.

---

## Endpoints que se ejercitan

**`listados.js`** (`GET`, con `?page=&limit=25`, rotando entre las paginas 1 a 3):

- `GET /api/v1/people/employees`
- `GET /api/v1/leaves/requests`
- `GET /api/v1/recruiting/candidates`
- `GET /api/v1/helpdesk/tickets`

**`marcacion.js`**:

- `POST /api/v1/time/clock` con cuerpo `{ "type": "...", "source": "web" }`, donde
  `type` recorre el ciclo permitido `in -> break_start -> break_end -> out`.
- `GET /api/v1/time/clock/today`

El tamano de pagina es 25 porque es `PAGINATION.DEFAULT_LIMIT` en
`packages/shared`: es lo que realmente pide la interfaz.

---

## Umbrales y su justificacion

Un umbral incumplido hace que k6 termine con codigo de salida distinto de cero,
asi que sirven directamente como criterio de aceptacion en CI.

### `listados.js`

| Umbral | Valor | Por que |
| --- | --- | --- |
| `http_req_duration` | `p(95)<800` | Un listado paginado es un `findMany` + un `count` sobre el mismo filtro. Por debajo de 800 ms el p95 se mantiene dentro del margen en el que una lista todavia se siente instantanea; a partir de ~1 s el usuario percibe espera. |
| `http_req_failed` | `rate<0.01` | Son lecturas con un token valido: no hay ningun fallo esperado. El 1% deja espacio para una desconexion aislada y nada mas. |
| `checks` | `rate>0.99` | Detecta el caso en que el HTTP responde 200 pero el cuerpo no trae el sobre `{ data, meta }` que esperan los clientes. |
| `respuestas_429` | `rate==0` | Metrica propia. Un solo 429 significa que no se subio `THROTTLE_LIMIT` y que todas las demas cifras describen al limitador, no a la API. |
| `listado_colaboradores` | `p(95)<800` | Metrica propia por endpoint. Es el listado que abre toda la empresa cada manana, asi que recibe el presupuesto mas exigente. |
| `listado_ausencias` | `p(95)<800` | Mismo caso: es la bandeja diaria de aprobaciones. |
| `listado_candidatos` | `p(95)<900` | Carga mas joins (etiquetas y conteo de postulaciones) y lo usa un equipo pequeno, asi que admite algo mas de margen. |
| `listado_tickets` | `p(95)<900` | Igual: incluye categoria, solicitante y asignado en cada fila. |

Las cuatro metricas `Trend` por endpoint existen para poder responder *cual* de los
listados es el lento cuando `http_req_duration` global se sale del presupuesto; el
agregado por si solo no lo dice.

### `marcacion.js`

| Umbral | Valor | Por que |
| --- | --- | --- |
| `marcacion_registro` | `p(95)<1200` | Mas holgado que un listado porque una marcacion no es un solo `INSERT`: lee la ultima marcacion del dia, inserta, recalcula el dia de asistencia y emite un evento de dominio, todo dentro de la peticion. |
| `marcacion_consulta_dia` | `p(95)<500` | Son dos busquedas por el indice `(companyId, employeeId, localDate)` que devuelven pocas filas: debe seguir siendo rapida incluso mientras corren las escrituras. |
| `http_req_failed` | `rate<0.01` | Se evalua contra los estados aceptados (ver abajo), asi que aqui solo caen errores de servidor y timeouts, nunca los rechazos de negocio. |
| `respuestas_legitimas` | `rate>0.99` | Metrica propia: cada respuesta debe ser o una marcacion insertada o una regla de negocio conocida. Un 500 o un 403 rompen este umbral. |
| `respuestas_429` | `rate==0` | Igual que en los listados. |

No hay umbral sobre `marcaciones_insertadas` (el contador de escrituras que si
crearon una fila): con varios VUs marcando al mismo colaborador, cuantas ganan la
carrera de secuencia no es determinista y no puede decidir si la corrida pasa o no.

---

## Errores de negocio que NO son fallos

En `marcacion.js`, varios VUs marcan sobre el **mismo colaborador** a la vez. La API
valida la secuencia de marcaciones y responde:

- **`409 CLOCK_DUPLICATE`** — se intento la misma marcacion dos veces en menos de un
  minuto.
- **`422 CLOCK_SEQUENCE_INVALID`** — el tipo enviado no es uno de los permitidos
  despues de la ultima marcacion (`in -> out | break_start`, `break_start -> break_end`,
  `break_end -> out | break_start`, `out -> in`).

Las dos son la API **haciendo bien su trabajo**: esta rechazando un registro de
asistencia imposible. Bajo concurrencia no solo son posibles, son esperables.

Por eso el script declara `http.setResponseCallback(http.expectedStatuses(200, 201, 409, 422))`
y cuenta esas respuestas como validas en `respuestas_legitimas`. Sin eso,
`http_req_failed` reportaria una API rota cuando en realidad esta aplicando sus
reglas correctamente.

Lo que si es un fallo: cualquier `5xx`, un `403` (permisos o modulo mal
configurados), un `429` (limite de tasa sin subir) o un timeout.

---

## Interpretar la salida

Al terminar, k6 imprime un resumen. Lo relevante:

- `✓ / ✗` junto a cada umbral: un `✗` marca la corrida como fallida.
- `http_req_duration ... p(95)=...`: la latencia agregada.
- `listado_*` / `marcacion_*`: la latencia por endpoint, para localizar al culpable.
- `checks`: el porcentaje de comprobaciones de estado y de cuerpo que pasaron.

Si algo se sale del presupuesto, el primer sitio donde mirar son los logs de la API
(`apps/api`) y los tiempos de consulta de Prisma: en estos endpoints el cuello de
botella casi siempre es un `findMany` con joins o el `count` de la paginacion.
