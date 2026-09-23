# Comunicacion y cultura

Es el canal interno de la empresa: lo que Talento Humano necesita contarle a la
gente y lo que la gente necesita encontrar sin preguntar. Reune el muro de
publicaciones con acuse de lectura, los eventos, los reconocimientos entre
companeros, el catalogo de beneficios y la wiki interna. Publican Comunicaciones
y Talento Humano; cualquier colaborador lee, reacciona, se inscribe y reconoce.

## Que hace

- Publica entradas del muro (noticia, comunicado, evento o politica) escritas con el editor por bloques.
- Segmenta cada publicacion por audiencia: toda la empresa, sede, area o cargo.
- Marca la lectura al abrir el detalle y pide acuse explicito cuando el comunicado lo exige.
- Entrega el reporte de lectura: destinatarios, lecturas, acuses y sus porcentajes.
- Permite reaccionar (la misma reaccion dos veces la quita) y comentar, con moderacion para ocultar comentarios.
- Notifica a la audiencia al publicar, saltandose las preferencias del usuario cuando el comunicado requiere acuse.
- Mantiene el calendario de eventos de la empresa y la inscripcion del colaborador.
- Administra los valores corporativos y el muro de reconocimientos asociados a ellos.
- Muestra cumpleanos y aniversarios del mes, respetando a quien pidio no aparecer.
- Publica el catalogo de beneficios y recibe solicitudes de inscripcion.
- Lleva la wiki interna por categorias, con slug unico, version por edicion y conteo de vistas.

## Permisos

| Permiso | Para que |
|---|---|
| `communication.post.read` | Ver el muro, el detalle de una publicacion, reaccionar, comentar, confirmar lectura y ver las celebraciones |
| `communication.post.create` | Crear una publicacion |
| `communication.post.update` | Publicar una entrada y ver su reporte de lectura |
| `communication.post.delete` | Eliminar publicaciones |
| `communication.post.moderate` | Ocultar un comentario |
| `communication.event.read` | Ver el calendario de eventos e inscribirse |
| `communication.event.create` | Crear un evento |
| `communication.event.update` | Editar eventos |
| `communication.event.delete` | Eliminar eventos |
| `communication.recognition.read` | Ver el muro de reconocimientos y los valores corporativos |
| `communication.recognition.create` | Reconocer a un companero |
| `communication.recognition.delete` | Eliminar un reconocimiento |
| `communication.value.manage` | Crear valores corporativos |
| `communication.badge.manage` | Administrar insignias |
| `communication.benefit.read` | Ver el catalogo de beneficios y solicitar inscripcion |
| `communication.benefit.create` | Crear un beneficio |
| `communication.benefit.update` | Editar beneficios |
| `communication.benefit.delete` | Eliminar beneficios |
| `communication.wiki.read` | Leer articulos y categorias de la wiki |
| `communication.wiki.create` | Crear articulos y categorias |
| `communication.wiki.update` | Editar un articulo y subir su version |
| `communication.wiki.delete` | Eliminar articulos |

El catalogo define las cuatro acciones de cada recurso, pero hoy no hay endpoint
para `post.delete`, `event.update`, `event.delete`, `recognition.delete`,
`badge.manage`, `benefit.update`, `benefit.delete` ni `wiki.delete`.

## Endpoints

Prefijo `/communication`.

### Muro y comentarios

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/communication/feed` | Muro filtrado por la audiencia de quien consulta, fijados primero |
| GET | `/communication/posts/:id` | Detalle con audiencias, comentarios visibles y reacciones; marca la lectura |
| POST | `/communication/posts` | Crea la publicacion y sus audiencias |
| POST | `/communication/posts/:id/publish` | Publica y notifica a la audiencia |
| POST | `/communication/posts/:id/acknowledge` | Confirma la lectura obligatoria |
| POST | `/communication/posts/:id/reactions` | Agrega o quita una reaccion |
| POST | `/communication/posts/:id/comments` | Comenta, opcionalmente respondiendo a otro comentario |
| DELETE | `/communication/comments/:id` | Oculta un comentario |
| GET | `/communication/posts/:id/read-report` | Destinatarios, lecturas, acuses y porcentajes |

### Eventos, valores y reconocimientos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/communication/events` | Calendario de eventos con el conteo de inscritos |
| POST | `/communication/events` | Crea un evento |
| POST | `/communication/events/:id/register` | Inscribe al colaborador |
| GET | `/communication/recognitions` | Muro de reconocimientos publicos, filtrable por colaborador |
| POST | `/communication/recognitions` | Reconoce a un companero y lo notifica |
| GET | `/communication/values` | Valores corporativos activos |
| POST | `/communication/values` | Crea un valor corporativo |
| GET | `/communication/celebrations` | Cumpleanos y aniversarios del mes (`month`) |

### Beneficios y wiki

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/communication/benefits` | Catalogo de beneficios activos |
| POST | `/communication/benefits` | Crea un beneficio |
| POST | `/communication/benefits/:id/enroll` | Solicita la inscripcion a un beneficio |
| GET | `/communication/wiki` | Articulos publicados, con filtro por categoria y busqueda por titulo |
| GET | `/communication/wiki/:slug` | Articulo por slug; suma una vista |
| POST | `/communication/wiki` | Crea un articulo, en borrador o publicado |
| PATCH | `/communication/wiki/:id` | Actualiza el articulo y sube su version si cambian los bloques |
| GET | `/communication/wiki-categories` | Categorias de la wiki |
| POST | `/communication/wiki-categories` | Crea una categoria |

## Reglas de negocio

- **El muro se arma por audiencia, no por permiso.** El feed toma la sede, el area y el cargo del colaborador que consulta y devuelve las publicaciones sin audiencia o cuyas audiencias apunten a `all` o a alguno de esos tres valores. Solo entran las publicadas y no borradas, ordenadas por fijadas primero y luego por fecha de publicacion.
- **`role` como audiencia no filtra.** El esquema y el modelo aceptan `targetType = role`, pero ni el filtro del feed ni el calculo de destinatarios lo resuelven, asi que una audiencia por rol no alcanza a nadie.
- **Crear no es publicar.** La publicacion nace en `draft`, o en `scheduled` si se envio `publishAt`. El paso a `published` siempre ocurre por el endpoint de publicar; no hay proceso que publique solo lo programado.
- **Al publicar se calcula la lista real de destinatarios.** Si alguna audiencia es `all` o no hay ninguna, entran todos los colaboradores activos o en ausencia; si no, los de las sedes, areas y cargos indicados. Ese mismo conteo alimenta el reporte de lectura y el evento `post.published`.
- **Comunicado obligatorio con notificacion forzada.** Cuando la publicacion tiene `requiresAck`, el titulo de la notificacion se antepone con "Comunicado importante" y se envia con `force`, para que las preferencias de notificacion del usuario no la silencien.
- **La lectura se registra sola.** Abrir el detalle crea o actualiza el registro de lectura; el acuse es un segundo paso explicito que sella `acknowledged_at`. La tabla tiene `@@unique([postId, userId])`, asi que nunca hay dos lecturas del mismo usuario.
- **Reaccion como interruptor.** Enviar la misma reaccion que ya existe la elimina y responde `{ removed: true }`; si no existe, la crea y responde `{ added: true }`.
- **Moderar no borra.** Ocultar un comentario marca `is_hidden`; el texto sigue en la base y desaparece del detalle, que solo trae comentarios visibles y no borrados.
- **Nadie se reconoce a si mismo.** Si el destinatario del reconocimiento es el propio colaborador, se rechaza con `VALIDATION_FAILED` (422). El reconocimiento notifica al usuario del destinatario, si lo tiene, y emite `recognition.given`. El muro solo lista los reconocimientos publicos.
- **Inscribirse exige colaborador.** Inscribirse a un evento o solicitar un beneficio falla con `FORBIDDEN` (403) si el usuario no esta vinculado a un colaborador. Ambas operaciones son un upsert sobre la clave unica de evento o beneficio mas colaborador, asi que repetirlas no duplica: devuelven el registro al estado `registered` o `requested`.
- **La capacidad del evento se guarda, no se valida.** El campo existe en el evento, pero la inscripcion no lo compara contra el numero de inscritos.
- **Slug unico en la wiki.** El slug sale del titulo y, si ya existe, se le agrega un sufijo numerico hasta encontrar uno libre; la tabla refuerza `@@unique([companyId, slug])`.
- **La version del articulo sube solo con el contenido.** Editar bloques incrementa `version`; cambiar unicamente el titulo, el resumen o las etiquetas no. Publicar sella `published_at` y volver a borrador lo limpia.
- **Las vistas se cuentan al leer por slug**, no al listar.
- **Celebraciones con salida voluntaria.** Solo aparecen colaboradores activos con `hide_celebrations` en falso. Los aniversarios excluyen a quien ingreso este mismo ano, porque todavia no cumple uno.
- **Borrado logico en todo el modulo.** Publicaciones, comentarios, eventos, valores, reconocimientos, beneficios, categorias y articulos filtran por `deleted_at`.

## Datos

| Tabla | Que guarda |
|---|---|
| `posts` | Titulo, tipo, documento de bloques, extracto, estado, fijado, acuse obligatorio, permisos de comentario y reaccion, fechas de publicacion y vencimiento y vistas |
| `post_audiences` | A quien apunta cada publicacion: tipo de destino e id |
| `post_reads` | Lectura y acuse por usuario y publicacion |
| `post_reactions` | Reaccion por usuario, publicacion y emoji |
| `post_comments` | Comentarios en arbol, con `is_hidden` y borrado logico |
| `events` | Evento de empresa: fechas, lugar, enlace de reunion, cupo y si requiere inscripcion |
| `event_registrations` | Inscripcion por evento y colaborador, con estado y asistencia |
| `company_values` | Valores corporativos con icono, color, orden y si estan activos |
| `recognitions` | Quien reconoce a quien, el valor asociado, el mensaje, los puntos y si es publico |
| `badges`, `employee_badges` | Catalogo de insignias y las otorgadas a cada colaborador |
| `benefits` | Beneficio: categoria, proveedor, contacto, vigencia y si requiere inscripcion |
| `benefit_enrollments` | Solicitud de inscripcion por beneficio y colaborador, con estado y decision |
| `wiki_categories` | Categorias en arbol, con slug y orden |
| `wiki_articles` | Articulo: categoria, slug, resumen, bloques, estado, version, etiquetas y vistas |

Este modulo no cifra ninguna columna: no hay campos marcados como `/// Encrypted`
en el esquema ni llamadas de cifrado en el servicio. El contenido del muro, los
reconocimientos y la wiki es informacion interna de circulacion amplia.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/communication` | Muro de la empresa | Leer el feed, reaccionar, comentar, confirmar acuse y crear una publicacion |
| `/communication/posts/:id` | Muro de la empresa | Misma pagina del feed, alcanzada desde la notificacion de una publicacion |
| `/communication/recognitions` | Reconocimientos | Ver el muro y reconocer a un companero eligiendo un valor corporativo |
| `/communication/wiki` | Wiki y base de conocimiento | Buscar por titulo y categoria, leer el articulo y crear uno nuevo |
| `/communication/beneficios` | Beneficios | Ver el catalogo, solicitar inscripcion y crear un beneficio |

Los eventos, los valores corporativos y las celebraciones tienen endpoint pero no
pantalla propia.

## Limites

- No liquida nomina ni lleva contabilidad: no valoriza beneficios, puntos de reconocimiento ni eventos. Registra y exporta.
- No publica solo: las entradas programadas quedan en `scheduled` hasta que alguien las publique.
- No controla cupos de eventos ni aprueba inscripciones a beneficios; el estado de la inscripcion se cambia por fuera del modulo.
- No envia correo masivo propio: se apoya en el servicio de notificaciones.
- No versiona las publicaciones del muro; solo los articulos de la wiki llevan version.
- No entrega insignias: el modelo existe, pero no hay endpoint que las administre ni que las otorgue.
- No modera automaticamente: ocultar un comentario es una decision manual con permiso.
