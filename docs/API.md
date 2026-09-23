# API

Base: `/api/v1`. Contrato interactivo en `/api/docs` (OpenAPI).

## Convenciones

### Respuestas

Toda respuesta exitosa viene envuelta:

```json
{ "data": { "id": "...", "fullName": "Ana Perez" } }
```

Las listas paginadas agregan `meta`:

```json
{
  "data": [ ... ],
  "meta": { "total": 248, "page": 1, "limit": 25, "pages": 10 }
}
```

### Errores

```json
{
  "timestamp": "2026-09-22T23:45:25.874Z",
  "path": "/api/v1/leaves/requests",
  "statusCode": 422,
  "code": "INSUFFICIENT_BALANCE",
  "message": "Saldo insuficiente: dispone de 0 dias y solicita 3",
  "details": { "year": 2027, "availableDays": 0 }
}
```

`code` es estable y esta pensado para que el cliente reaccione; `message` es
texto para la persona y puede cambiar. `details` lleva el contexto util.

| Codigo HTTP | Significa |
|---|---|
| 400 | Peticion mal formada |
| 401 | Sin sesion o token vencido |
| 403 | Sin permiso, fuera de alcance o modulo desactivado |
| 404 | No existe, o existe en otra empresa |
| 409 | Conflicto de estado (solapamiento, duplicado) |
| 422 | Regla de negocio incumplida |
| 429 | Limite de tasa |

Algunos `code` frecuentes: `PERMISSION_DENIED`, `OUT_OF_SCOPE`,
`MODULE_DISABLED`, `LEAVE_OVERLAP`, `INSUFFICIENT_BALANCE`, `LEAVE_MAX_DAYS`,
`ETHICS_CODE_INVALID`, `RATE_LIMITED`.

### Paginacion, orden y busqueda

```
GET /people/employees?page=2&limit=50&sort=-hiredAt&search=ana
```

`sort` acepta un campo de una lista blanca por endpoint; el prefijo `-` invierte
el orden. `limit` tiene tope.

### Autenticacion

```
Authorization: Bearer <token de acceso>
```

El token dura 15 minutos. El de refresco viaja en cookie `httpOnly` y rota en
cada uso. El cliente web renueva de forma transparente al recibir un 401.

## Autenticacion

| Metodo | Ruta | Que hace |
|---|---|---|
| POST | `/auth/login` | Ingresa; devuelve token y sesion |
| POST | `/auth/refresh` | Rota el token de refresco |
| POST | `/auth/logout` | Cierra la sesion |
| GET | `/auth/me` | Perfil con permisos y modulos efectivos |
| POST | `/auth/forgot-password` | Envia enlace (siempre 204, no revela si existe) |
| POST | `/auth/reset-password` | Define una contrasena nueva |
| POST | `/auth/2fa/setup` · `/auth/2fa/enable` · `/auth/2fa/disable` | Segundo factor |
| POST | `/auth/switch-company` | Cambia de empresa activa |

## Portales publicos

Sin sesion. Limitados por tasa.

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/public/careers/:slug` | Vacantes publicadas |
| GET | `/public/careers/:slug/jobs/:jobSlug` | Detalle de la vacante |
| POST | `/public/careers/:slug/jobs/:jobSlug/apply` | Postulacion |
| GET | `/public/ethics/:slug` | Categorias del canal de denuncias |
| POST | `/public/ethics/:slug/reports` | Denuncia; devuelve codigo y clave |
| POST | `/public/ethics/follow-up` | Estado con codigo y clave |
| POST | `/public/ethics/messages` | Mensaje al investigador |
| POST | `/public/:slug/uploads` | Adjunto sin sesion (PDF, Word, imagen) |
| GET | `/public/verify/:code` | Verificacion de un documento |
| GET | `/public/offers/:token` | Carta de oferta por enlace unico |
| GET | `/onboarding/preboarding/:token` | Bienvenida previa al ingreso |

## Modulos

421 endpoints en 16 modulos. Resumen por area; el detalle vive en
[MODULES/](MODULES/) y el contrato exacto en `/api/docs`.

| Modulo | Prefijo | Endpoints principales |
|---|---|---|
| Personal | `/people` | Colaboradores, contratos, documentos, movimientos, activos, familiares |
| Organizacion | `/organization` | Sedes, areas, cargos, centros de costo, organigrama, directorio |
| Seleccion | `/recruiting` | Requisiciones, vacantes, pipeline, entrevistas, ofertas, contratacion |
| Onboarding | `/onboarding` | Plantillas, procesos, tareas, entrevistas de salida |
| Ausencias | `/leaves` | Tipos, politicas, saldos, solicitudes, calendario, festivos, novedades, exportacion |
| Tiempo | `/time` | Marcacion, asistencia, turnos, correcciones |
| Formacion | `/learning` | Cursos, modulos, lecciones, inscripciones, evaluaciones, certificados |
| Desempeno | `/performance` | Objetivos, ciclos, evaluaciones, nine-box, feedback |
| Comunicacion | `/communication` | Publicaciones, reconocimientos, wiki, beneficios |
| Encuestas | `/surveys` | Encuestas, invitaciones, respuestas, resultados por segmento |
| Etica | `/ethics` | Denuncias, casos, acciones, estadisticas |
| Documentos | `/documents` | Plantillas, generacion, politicas, acuses, firmas |
| Servicio | `/helpdesk` | Tickets, categorias, SLA, macros, base de conocimiento |
| SST | `/sst` | Examenes, accidentes, matriz de riesgos, EPP, inspecciones, comites |
| Analitica | `/analytics` | Tablero ejecutivo, alertas, riesgo de rotacion, constructor de reportes |
| Configuracion | `/settings` `/users` `/audit` `/integrations` | Empresa, catalogos, campos, modulos, roles, auditoria, webhooks |

## Reglas que conviene conocer antes de integrar

**Alcance de datos.** El mismo endpoint devuelve conjuntos distintos segun quien
pregunte. `GET /leaves/requests` devuelve las propias a un colaborador, las de su
equipo a un jefe y todas a talento humano. No es un filtro opcional: es el
alcance del permiso.

**404 en vez de 403 entre empresas.** Un identificador de otra empresa responde
como inexistente. Distinguir "no existe" de "no puede verlo" ya filtraria
informacion.

**Nada se calcula sobre dinero.** `/leaves/payroll-export` entrega novedades
clasificadas con su codigo de nomina. No trae valores liquidados porque la
plataforma no los calcula.

**El canal de denuncias no acepta sesion.** Los endpoints publicos de etica no
leen ni escriben identidad, a proposito.

## Integraciones

| Mecanismo | Como |
|---|---|
| API key | Cabecera `X-Api-Key`. La clave se muestra una sola vez al crearla y solo concede los permisos elegidos, siempre a alcance de empresa; no abre sesion ni tiene colaborador asociado |
| Webhook | `POST` con firma `X-Talento-Signature` (HMAC-SHA256 del cuerpo) |

Verificacion de la firma:

```js
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

Los eventos disponibles estan en `GET /integrations/events`. Una entrega
fallida se reintenta hasta cinco veces con retroceso exponencial (30 s, 1, 2 y
4 min) y queda como `failed` si ninguna responde 2xx.
