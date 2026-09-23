# Centro de ayuda

Es la mesa de servicio de Talento Humano: el colaborador pregunta o reclama por
un ticket en vez de por correo suelto, y el area atiende con categorias, tiempos
de respuesta comprometidos y respuestas guardadas. Antes de abrir el ticket se
le sugieren articulos de la base de conocimiento, y al cerrarlo se le pide
calificar la atencion. El area mide backlog, tiempos y cumplimiento de SLA.

## Que hace

- Recibe tickets del colaborador con asunto, descripcion, categoria, prioridad y archivos adjuntos.
- Numera cada ticket con un consecutivo por empresa.
- Asigna tiempos de primera respuesta y de resolucion al crear el ticket, tomados de la politica de SLA de la categoria o de la predeterminada.
- Asigna automaticamente un agente si la categoria tiene responsable por defecto, y le notifica.
- Lleva la conversacion del ticket con mensajes publicos y notas internas que el solicitante no ve.
- Marca la primera respuesta del agente y mueve el estado solo.
- Permite reasignar el ticket a otro agente y cambiar estado, prioridad o categoria.
- Cierra el ticket con nota de resolucion opcional y marca si se incumplio el tiempo comprometido.
- Recoge la calificacion del servicio (CSAT) de 1 a 5 con comentario, una por ticket.
- Administra categorias jerarquizables, politicas de SLA y macros de respuesta.
- Mantiene una base de conocimiento con articulos publicados, etiquetas y contador de vistas.
- Sugiere articulos mientras el colaborador escribe el asunto, antes de abrir el ticket.
- Registra canales conectables (correo, WhatsApp, redes, chat web) como configuracion.
- Publica indicadores: backlog, tickets por estado y categoria, horas de primera respuesta y de resolucion, cumplimiento de SLA y CSAT promedio.
- Emite eventos y avisos en tiempo real cuando se crea un ticket o llega un mensaje.

## Permisos

| Permiso | Para que |
|---|---|
| `helpdesk.ticket.read` | Ver la bandeja y el detalle, escribir mensajes publicos, calificar y ver categorias, macros e indicadores |
| `helpdesk.ticket.create` | Abrir un ticket |
| `helpdesk.ticket.update` | Cambiar estado, prioridad o categoria, y escribir notas internas |
| `helpdesk.ticket.assign` | Asignar el ticket a un agente |
| `helpdesk.ticket.close` | Resolver y cerrar el ticket |
| `helpdesk.category.manage` | Crear categorias de ticket |
| `helpdesk.macro.manage` | Crear macros de respuesta |
| `helpdesk.kb.read` | Ver y buscar la base de conocimiento y recibir sugerencias |
| `helpdesk.kb.create` | Crear un articulo |
| `helpdesk.kb.update` | Editar un articulo; hoy no tiene endpoint propio |
| `helpdesk.kb.delete` | Eliminar un articulo; hoy no tiene endpoint propio |
| `helpdesk.sla.manage` | Ver y crear politicas de SLA |
| `helpdesk.channel.manage` | Ver y registrar canales conectados |

## Endpoints

Prefijo `/helpdesk`.

### Tickets

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/helpdesk/tickets` | Bandeja con filtros de estado, prioridad, categoria, agente, `mine=true` y busqueda por asunto |
| GET | `/helpdesk/tickets/:id` | Detalle con categoria, solicitante, agente, conversacion y CSAT |
| POST | `/helpdesk/tickets` | Crea el ticket, calcula el SLA y notifica al agente por defecto |
| POST | `/helpdesk/tickets/:id/messages` | Agrega un mensaje publico o una nota interna |
| PATCH | `/helpdesk/tickets/:id` | Cambia estado, prioridad o categoria |
| POST | `/helpdesk/tickets/:id/assign` | Asigna el ticket y lo pasa a `open` |
| POST | `/helpdesk/tickets/:id/close` | Resuelve, cierra y evalua el incumplimiento de SLA |
| POST | `/helpdesk/tickets/:id/csat` | Registra o actualiza la calificacion de la atencion |
| GET | `/helpdesk/metrics` | Indicadores del centro de ayuda |

### Configuracion del servicio

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/helpdesk/categories` | Categorias activas, ordenadas por posicion |
| POST | `/helpdesk/categories` | Crea una categoria con su SLA y su responsable por defecto |
| GET | `/helpdesk/sla-policies` | Politicas de SLA de la empresa |
| POST | `/helpdesk/sla-policies` | Crea una politica de SLA |
| GET | `/helpdesk/macros` | Macros de respuesta activas |
| POST | `/helpdesk/macros` | Crea una macro |
| GET | `/helpdesk/channels` | Canales registrados |
| POST | `/helpdesk/channels` | Registra un canal conectable |

### Base de conocimiento

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/helpdesk/kb` | Articulos publicados, con busqueda por titulo y orden por vistas |
| GET | `/helpdesk/kb/suggest` | Hasta 5 articulos sugeridos para el texto `q` |
| POST | `/helpdesk/kb` | Crea el articulo como borrador o publicado |

## Reglas de negocio

- **Modulo activo.** Todo el controlador exige el modulo `helpdesk`; sin el, la respuesta es `MODULE_DISABLED` (403) antes de mirar permisos.
- **Consecutivo por empresa.** El numero del ticket es el mayor existente mas uno, y la base lo refuerza con `@@unique([companyId, number])`.
- **De donde sale el SLA.** Al crear el ticket se busca la politica de la categoria elegida; si la categoria no tiene, se usa la marcada como predeterminada; si tampoco hay, el ticket queda sin fechas comprometidas.
- **Como se calcula el vencimiento.** Sobre el instante de creacion se suman `first_response_minutes` y `resolution_minutes` convertidos a milisegundos. El calculo usa minutos corridos: `business_hours_only` se guarda en la politica pero hoy no cambia el resultado, asi que un ticket abierto un viernes vence contando el fin de semana.
- **Una sola politica predeterminada.** Crear una politica con `isDefault` desmarca la anterior antes de guardar.
- **Alcance de la bandeja.** Si el alcance de `helpdesk.ticket.read` no es `company`, o si se pide `mine=true`, la lista se limita a los tickets donde el usuario es solicitante o el colaborador es el agente asignado.
- **Detalle fuera de alcance.** Pedir un ticket que no es propio sin alcance de empresa devuelve `OUT_OF_SCOPE` (403); si el ticket no existe o esta eliminado, `NOT_FOUND` (404).
- **Las notas internas no salen.** Solo quien tiene alcance de empresa ve los mensajes con `is_internal`; al resto se le entrega la conversacion filtrada. Escribir una nota interna exige `helpdesk.ticket.update` aunque el endpoint de mensajes pida solo lectura; sin ese permiso la respuesta es `PERMISSION_DENIED` (403).
- **El estado se mueve solo con la conversacion.** Un mensaje publico escrito por alguien distinto del solicitante cuenta como respuesta del agente: deja el ticket en `pending_requester` y sella `first_response_at` si aun estaba vacio. Cualquier otro mensaje solo saca el ticket de `new` y lo pasa a `open`. Las notas internas no mueven el estado ni notifican.
- **Asignar abre el ticket.** Al asignar un agente el estado pasa a `open` en la misma operacion, para que no quede en `new` con responsable.
- **Cierre e incumplimiento.** Cerrar exige que el ticket exista (`NOT_FOUND`, 404). Si se envia nota de resolucion se publica primero como mensaje visible. `sla_breached` queda en verdadero solo si habia `resolution_due_at` y el cierre ocurrio despues. Se sellan `resolved_at` y `closed_at` con el mismo instante y el estado queda en `resolved`.
- **Una calificacion por ticket.** El CSAT es un `upsert` sobre `ticket_id`, que es unico; volver a calificar reemplaza la nota y el comentario. El rango aceptado es 1 a 5.
- **Como se calculan los indicadores.** El backlog cuenta tickets en `new`, `open` u `on_hold`. Los promedios de primera respuesta y de resolucion se toman sobre los ultimos 500 tickets resueltos, en horas con un decimal. El cumplimiento de SLA es el porcentaje de esos resueltos sin incumplimiento, y es 100 cuando todavia no hay ninguno. El CSAT es el promedio de las calificaciones con dos decimales.
- **Slug de articulo sin choques.** El titulo se convierte en slug; si ya existe, se le agrega un sufijo numerico creciente hasta encontrar uno libre. La base exige `@@unique([companyId, slug])`.
- **La sugerencia no adivina.** Con texto vacio devuelve lista vacia; si hay texto, busca coincidencias en titulo, resumen o etiquetas de articulos publicados y devuelve como maximo 5.
- **Adjuntos por referencia.** Los archivos del ticket y de cada mensaje se enlazan en `file_links` como `ticket` y `ticket_message`; el archivo en si vive en el modulo de archivos.
- **Avisos en vivo.** Crear un ticket emite `ticket.created` a la empresa y un mensaje publico emite `ticket.message` a la sala del ticket. Ademas se emiten los eventos de dominio `ticket.created` y `ticket.closed`, y se notifica al agente asignado y al solicitante segun el caso.

## Datos

| Tabla | Que guarda |
|---|---|
| `ticket_categories` | Categoria por empresa y codigo, con padre opcional, SLA, responsable por defecto y posicion |
| `sla_policies` | Minutos de primera respuesta y de resolucion, si aplica solo en horario laboral y si es la predeterminada |
| `tickets` | Numero, asunto, descripcion, estado, prioridad, solicitante, agente, canal, fechas comprometidas y reales, incumplimiento y reaperturas |
| `ticket_messages` | Cada mensaje con autor, cuerpo, canal y si es nota interna |
| `macros` | Respuestas guardadas por empresa, con categoria opcional y si estan activas |
| `kb_articles` | Articulo con slug, bloques, resumen, estado, etiquetas, vistas y votos de utilidad |
| `channels` | Canal registrado: tipo, nombre, configuracion, si esta activo y su ultima sincronizacion |
| `channel_messages` | Mensajes de entrada y salida de un canal, con referencia externa y carga original |
| `csat_responses` | Calificacion y comentario, uno por ticket |

Ninguna columna de este modulo va cifrada: el esquema no marca campos como
cifrados y el servicio no llama al cifrador. Si un ticket contiene informacion
reservada, la proteccion es el alcance de datos y la nota interna, no el cifrado.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/helpdesk` | Centro de ayuda | Bandeja con filtros e indicadores, apertura de ticket con sugerencia de articulos |
| `/helpdesk/tickets/:id` | Asunto del ticket | Conversacion, notas internas, macros, cambio de estado, asignacion, cierre y CSAT |
| `/helpdesk/conocimiento` | Base de conocimiento | Buscar articulos publicados y crear uno nuevo |
| `/portal/tickets/:id` | Asunto del ticket | El mismo detalle dentro del portal del colaborador |

El detalle usa el asunto del ticket como titulo y muestra el numero y el tiempo
transcurrido como subtitulo. Las categorias, las politicas de SLA, las macros y
los canales se crean por API o desde los formularios de la pagina que los usa;
no tienen pantalla de administracion propia.

## Limites

- No liquida nomina ni lleva contabilidad. Un ticket sobre un descuento se registra y se responde; el valor lo resuelve el sistema de nomina.
- El calculo de SLA no respeta horario laboral ni festivos: suma minutos corridos aunque la politica tenga marcado `business_hours_only`.
- Los canales son por ahora solo registro de configuracion. Existe el punto de extension para conectar correo, WhatsApp y redes, pero no hay ningun adaptador registrado, asi que no entra ni sale nada por esos canales.
- No hay escalamiento automatico ni reasignacion por vencimiento: el incumplimiento se marca al cerrar, no dispara nada.
- No existe endpoint para reabrir un ticket cerrado, ni para editar o eliminar articulos, categorias, macros, politicas de SLA o canales ya creados.
- El contador de vistas y los votos de utilidad de los articulos existen en la tabla, pero ningun endpoint los incrementa.
- No hay chat en vivo ni bot de respuesta: lo que se ofrece antes de abrir el ticket son articulos ya escritos por el equipo.
