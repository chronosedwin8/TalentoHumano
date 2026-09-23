# Formacion

Es el campus interno: cursos con contenido propio, inscripciones, avance,
cuestionarios y certificados. Lo usan Talento Humano y los lideres de formacion
para armar y asignar contenido, y cualquier colaborador para hacer sus cursos
obligatorios y de libre inscripcion.

## Que hace

- Mantiene un catalogo de cursos internos y externos, con categoria, duracion estimada, si son obligatorios y cada cuanto se recertifican.
- Organiza cada curso en modulos y lecciones.
- Edita el contenido de la leccion con un editor por bloques, con borrador separado de lo publicado.
- Versiona cada publicacion de contenido y permite restaurar una version anterior.
- Guarda conjuntos de bloques como patrones reutilizables.
- Administra una galeria de medios por empresa.
- Controla que dominios se pueden incrustar mediante una lista blanca por empresa.
- Arma cuestionarios con banco de preguntas y los califica al enviarlos, con limite de intentos.
- Inscribe colaboradores a cursos, con fecha limite y vencimiento por recertificacion.
- Registra avance por bloque y por leccion, y lo consolida en la inscripcion.
- Emite el certificado automaticamente al completar el curso.
- Programa sesiones presenciales y virtuales, y registra asistencia.
- Define rutas de aprendizaje por cargo o area.
- Lleva el plan anual de capacitacion con presupuesto informativo y necesidades detectadas.
- Calcula indicadores: inscripciones, tasa de finalizacion, cumplimiento de obligatorios, nota promedio y horas por colaborador.

## Permisos

| Permiso | Para que |
|---|---|
| `learning.course.read` | Ver el catalogo, el detalle, las rutas y los cursos propios |
| `learning.course.create` | Crear un curso |
| `learning.course.update` | Editar un curso |
| `learning.course.delete` | Archivar un curso |
| `learning.course.publish` | Publicar un curso |
| `learning.lesson.read` | Ver lecciones, versiones, patrones y la lista blanca de embeds |
| `learning.lesson.create` | Crear modulos y lecciones |
| `learning.lesson.update` | Guardar borrador, publicar contenido y restaurar versiones |
| `learning.lesson.delete` | Eliminar una leccion |
| `learning.media.read` | Ver la galeria de medios |
| `learning.media.upload` | Registrar un archivo en la galeria |
| `learning.media.delete` | Eliminar un archivo de la galeria |
| `learning.pattern.manage` | Guardar bloques como patron reutilizable |
| `learning.embedprovider.manage` | Administrar la lista blanca de dominios de embed |
| `learning.quiz.manage` | Crear y administrar cuestionarios y preguntas |
| `learning.enrollment.read` | Ver inscripciones |
| `learning.enrollment.create` | Inscribir colaboradores |
| `learning.enrollment.delete` | Eliminar una inscripcion |
| `learning.path.manage` | Administrar rutas de aprendizaje |
| `learning.session.read` | Ver sesiones programadas |
| `learning.session.create` | Programar una sesion |
| `learning.session.update` | Registrar asistencia a una sesion |
| `learning.progress.read` | Ver progreso e indicadores; tambien registrar avance y responder cuestionarios |
| `learning.certificate.read` | Ver certificados emitidos |
| `learning.certificate.issue` | Emitir un certificado |
| `learning.plan.manage` | Ver y crear el plan anual de capacitacion |

## Endpoints

Prefijo `/learning`.

### Cursos y contenido

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/learning/courses` | Catalogo de cursos |
| GET | `/learning/courses/:id` | Curso con sus modulos y lecciones |
| POST | `/learning/courses` | Crea un curso |
| PATCH | `/learning/courses/:id` | Actualiza un curso |
| POST | `/learning/courses/:id/publish` | Publica el curso |
| DELETE | `/learning/courses/:id` | Archiva un curso |
| POST | `/learning/modules` | Crea un modulo dentro de un curso |
| POST | `/learning/lessons` | Crea una leccion |
| GET | `/learning/lessons/:id` | Leccion con su documento de bloques |
| POST | `/learning/lessons/:id/content` | Guarda el borrador o publica el contenido |
| GET | `/learning/lessons/:id/versions` | Historial de versiones |
| POST | `/learning/lessons/:id/versions/:version/restore` | Restaura una version anterior |
| GET | `/learning/patterns` | Patrones reutilizables de bloques |
| POST | `/learning/patterns` | Guarda bloques como patron |
| GET | `/learning/media` | Galeria de medios |
| POST | `/learning/media` | Registra un archivo en la galeria |
| GET | `/learning/embed-providers` | Lista blanca de dominios |
| POST | `/learning/embed-providers` | Agrega un dominio a la lista blanca |

### Inscripcion, avance y certificacion

| Metodo | Ruta | Que hace |
|---|---|---|
| POST | `/learning/quizzes` | Crea un cuestionario con sus preguntas |
| POST | `/learning/quizzes/:id/submit` | Envia respuestas y recibe la calificacion |
| GET | `/learning/enrollments` | Inscripciones a cursos |
| POST | `/learning/enrollments` | Inscribe colaboradores |
| GET | `/learning/my-courses` | Cursos del colaborador autenticado |
| POST | `/learning/progress` | Registra avance en una leccion o bloque |
| GET | `/learning/sessions` | Sesiones presenciales y virtuales |
| POST | `/learning/sessions` | Programa una sesion |
| POST | `/learning/sessions/:id/attendance` | Registra asistencia |
| GET | `/learning/paths` | Rutas de aprendizaje |
| POST | `/learning/paths` | Crea una ruta por cargo o area |
| GET | `/learning/certificates` | Certificados emitidos |
| GET | `/learning/metrics` | Indicadores de formacion |
| GET | `/learning/plans` | Plan anual de capacitacion |
| POST | `/learning/plans` | Crea el plan anual |

## Reglas de negocio

- **Lista blanca de dominios para embeds** (`EMBED_DOMAIN_NOT_ALLOWED`, 422). Antes de guardar contenido se recorre el arbol de bloques, incluidos los anidados, y cada bloque de tipo `embed` se valida contra los dominios que la empresa permite. Se acepta el dominio exacto y sus subdominios. Si la URL no se puede interpretar, se rechaza con `VALIDATION_FAILED`. Cuando la empresa no ha configurado nada, se usa la lista por defecto del sistema. La misma lista alimenta la politica `frame-src` del navegador, asi que dejar un dominio fuera no es cosmetico: el contenido no cargaria.
- **Borrador separado de lo publicado.** Guardar sin publicar escribe solo en `draft_blocks` y deja intacto lo que la gente esta viendo. Publicar mueve el borrador a `blocks`, lo limpia, sube el numero de version y deja una fila en el historial con la nota de cambio.
- **Slug unico por curso.** El titulo se convierte en slug y, si choca, se le agrega un sufijo numerico.
- **Inscribir es idempotente.** La inscripcion es unica por curso y colaborador: volver a inscribir actualiza la fecha limite y devuelve el estado a `assigned` en vez de duplicar. Si el curso tiene recertificacion, la inscripcion nace con fecha de vencimiento a esos meses.
- **Avance por bloques requeridos.** Un bloque marcado como requerido cuenta para el avance de la leccion; el porcentaje es la proporcion de bloques requeridos completados. Si la leccion no tiene bloques requeridos, se completa solo cuando alguien lo declara explicitamente.
- **Avance de la inscripcion por lecciones requeridas.** Se calcula sobre las lecciones requeridas y no borradas del curso. Al llegar al 100 por ciento la inscripcion pasa a `completed`, se sella la fecha y se emite el evento `course.completed`.
- **Certificado automatico y unico.** Completar emite el certificado en el acto, con numero consecutivo `CERT-000001`. Si ya existe uno para esa inscripcion, se devuelve el existente en vez de emitir otro. El certificado hereda el vencimiento de la recertificacion del curso.
- **Cuestionario con intentos limitados** (`QUIZ_NO_ATTEMPTS_LEFT`, 409). Se cuentan los intentos previos de ese colaborador en ese cuestionario y se corta al llegar al maximo. La respuesta de cada envio dice cuantos intentos quedan.
- **Calificacion.** Una pregunta se da por correcta solo si el conjunto de opciones marcadas coincide exactamente con el conjunto de opciones correctas: ni de mas ni de menos. La nota es el porcentaje de puntos obtenidos y se aprueba al alcanzar el minimo del cuestionario. El detalle por pregunta solo se devuelve si el cuestionario esta configurado para mostrar respuestas.
- **Aprobar un cuestionario cierra su leccion.** Si el envio viene asociado a una inscripcion y el cuestionario pertenece a una leccion, aprobarlo marca esa leccion como completada y guarda la nota en la inscripcion.
- **Responder exige ser colaborador.** Un usuario sin colaborador asociado no puede enviar un cuestionario.
- **Indicadores.** La tasa de finalizacion es el porcentaje de inscripciones completadas; el cumplimiento de obligatorios se calcula solo sobre las inscripciones a cursos marcados como obligatorios, y vale 100 cuando no hay ninguno. Las horas por colaborador dividen el tiempo total registrado entre los colaboradores activos.

## Datos

| Tabla | Que guarda |
|---|---|
| `courses` | Curso: tipo, proveedor, duracion estimada, si es obligatorio, meses de recertificacion, nota minima y costo informativo |
| `course_modules`, `lessons` | Estructura del curso y sus lecciones, con si son requeridas |
| `lesson_contents` | Documento de bloques publicado y el borrador, con su version |
| `lesson_content_versions` | Historial de cada publicacion, con nota de cambio |
| `content_patterns` | Conjuntos de bloques reutilizables; los sincronizados propagan sus ediciones |
| `media_library`, `media_folders` | Galeria de medios, incluida la lista HLS cuando el transcodificador la produce |
| `embed_providers` | Dominios permitidos para incrustar, con su URL de oEmbed |
| `quizzes`, `questions`, `question_options`, `quiz_attempts` | Cuestionarios, banco de preguntas y cada intento con sus respuestas |
| `assignments_lms`, `assignment_submissions` | Trabajos asignados y sus entregas |
| `learning_paths`, `learning_path_items` | Rutas de aprendizaje y su contenido ordenado |
| `enrollments`, `lesson_progress` | Inscripcion con avance, nota y vencimiento; avance por leccion con el estado de cada bloque |
| `training_sessions`, `session_attendance` | Sesiones programadas y asistencia; la sesion guarda el token del codigo QR de asistencia |
| `certificates` | Certificado emitido: codigo, fecha, vencimiento y nota |
| `course_feedback` | Valoracion del curso por parte del colaborador |
| `training_plans`, `training_needs` | Plan anual con presupuesto informativo y necesidades detectadas |
| `xapi_statements` | Sentencias xAPI reportadas por H5P y otros embeds interactivos |

No hay columnas cifradas en este modulo. Tanto `courses.informative_cost` como
`training_plans.budget` estan marcados en el esquema como cifras informativas
sobre las que no se hace contabilidad.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/learning` | Mi formacion | Cursos asignados, obligatorios y de libre inscripcion |
| `/learning/catalogo` | Catalogo de cursos | Cursos internos y externos, y su creacion |
| `/learning/courses/:id` | Detalle del curso | Estructura de modulos y lecciones, e inscripciones |
| `/learning/lecciones/:id` | Leccion | Consumo del contenido por bloques y registro de avance |
| `/learning/lecciones/:id/editar` | Editor de leccion | Edicion por bloques, borrador, publicacion y versiones |

## Limites

- No lleva contabilidad del presupuesto de formacion: el costo del curso y el presupuesto del plan anual son cifras informativas.
- No aloja video por si mismo: el contenido externo se incrusta desde dominios de la lista blanca, y los medios propios se guardan como archivos.
- No emite certificados con validez ante terceros ni firma digital; el certificado es un registro interno con codigo consecutivo.
- No es un LMS con estandar SCORM: la interoperabilidad se limita a las sentencias xAPI que reportan los embeds interactivos.
- No asigna cursos automaticamente por cargo: las rutas de aprendizaje se definen, pero la inscripcion se dispara desde onboarding o a mano.
- La asistencia a sesiones no alimenta el modulo de tiempo y asistencia.
