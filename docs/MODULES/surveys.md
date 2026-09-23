# Encuestas y clima

Permite preguntarle a la organizacion sin que nadie quede expuesto: clima, eNPS,
pulsos, ingreso, retiro y cuestionarios a la medida. Talento Humano arma la
encuesta, la publica a una audiencia y lee resultados agregados; el colaborador
responde una sola vez, de forma anonima por defecto. El anonimato no es una
promesa escrita: el servicio no guarda el vinculo entre persona y respuesta, y
oculta los segmentos con pocas respuestas.

## Que hace

- Construye la encuesta con un cuestionario de quince tipos de pregunta: texto, numero, fecha, seleccion, likert, nps, matriz, ranking, rating, booleano y secciones, entre otros.
- Admite preguntas obligatorias, opciones con puntaje, dimension por pregunta y condiciones para mostrar u ocultar campos.
- Versiona el cuestionario y materializa cada pregunta de la version para poder agregar resultados.
- Segmenta la audiencia por toda la empresa, sede, area o cargo.
- Al publicar genera una invitacion por colaborador, con token propio, y le notifica.
- Guarda con la invitacion el segmento del colaborador (area, sede, cargo, genero y antiguedad) para poder cortar resultados sin identificar a nadie.
- Recibe la respuesta, la marca como completa y sella la invitacion como respondida.
- Calcula participacion, promedio y distribucion por pregunta, eNPS e indice de clima.
- Corta resultados por segmento y oculta los que no llegan al umbral minimo de respuestas.
- Entrega una nube de palabras sobre las respuestas abiertas.
- Cierra y archiva encuestas, y ofrece plantillas de la empresa y del sistema.
- Muestra al colaborador sus encuestas pendientes de responder.

## Permisos

| Permiso | Para que |
|---|---|
| `surveys.survey.read` | Ver la lista de encuestas, el detalle con su esquema vigente y las plantillas |
| `surveys.survey.create` | Crear una encuesta con su cuestionario y su audiencia |
| `surveys.survey.update` | Editar una encuesta |
| `surveys.survey.delete` | Archivar una encuesta |
| `surveys.survey.publish` | Publicar la encuesta y cerrarla |
| `surveys.result.read` | Ver resultados agregados, segmentos y analisis de texto |
| `surveys.result.export` | Exportar resultados |
| `surveys.response.submit` | Ver las encuestas propias pendientes y enviar la respuesta |
| `surveys.template.manage` | Administrar plantillas de encuesta |

`surveys.survey.update`, `surveys.result.export` y `surveys.template.manage`
estan en el catalogo pero todavia no tienen endpoint: el cuestionario no se
edita por API despues de creado, los resultados no se exportan desde aqui y las
plantillas solo se consultan.

## Endpoints

Prefijo `/surveys`.

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/surveys` | Encuestas de la empresa, con filtros por estado y tipo y el conteo de invitaciones y respuestas |
| GET | `/surveys/mine` | Encuestas abiertas que el colaborador aun no ha respondido, con su token |
| GET | `/surveys/:id` | Detalle con la ultima version del cuestionario y las audiencias |
| POST | `/surveys` | Crea la encuesta, su version 1 y sus audiencias |
| POST | `/surveys/:id/publish` | Abre la encuesta, genera las invitaciones y notifica |
| POST | `/surveys/:id/close` | Cierra la encuesta y fija la fecha de cierre |
| POST | `/surveys/:id/responses` | Registra la respuesta del colaborador |
| GET | `/surveys/:id/results` | Resultados agregados; con `segmentBy` corta por segmento |
| GET | `/surveys/:id/text-analysis` | Frecuencia de palabras de una pregunta abierta (`questionKey`) |
| DELETE | `/surveys/:id` | Archiva la encuesta (borrado logico) |
| GET | `/surveys/templates/all` | Plantillas de la empresa y las del sistema |

## Reglas de negocio

- **El cuestionario vive en versiones.** Crear la encuesta guarda la version 1 con el esquema completo en JSON y, ademas, materializa cada campo como pregunta con su clave, tipo, dimension, posicion y obligatoriedad. Los campos de tipo `section` no generan pregunta porque son separadores visuales, no algo que se responda. La encuesta apunta a su version vigente con `current_version_id`.
- **Publicar es generar invitaciones.** Se resuelve la audiencia a colaboradores activos o en ausencia, se hace upsert de una invitacion por persona con un token aleatorio de 24 caracteres y se pasa la encuesta a `open`. La clave `@@unique([surveyId, employeeId])` evita duplicados: volver a publicar solo actualiza `sent_at`. La respuesta del endpoint es el numero de invitaciones.
- **El segmento se congela en la invitacion.** Area, sede, cargo, genero y banda de antiguedad se copian al invitar. Asi los resultados se pueden cortar por area aunque la persona cambie de area despues, y sin tener que consultar su ficha al agregar.
- **Responder exige encuesta abierta.** Si el estado no es `open` se rechaza con `SURVEY_CLOSED` (409). Si la encuesta no existe o esta archivada, `NOT_FOUND` (404).
- **Una respuesta por persona.** La invitacion se ubica por token o, si no viene, por el colaborador de la sesion. Si ya tiene `responded_at`, se rechaza con `SURVEY_ALREADY_ANSWERED` (409). La invitacion se marca como respondida incluso en encuestas anonimas: es lo que impide responder dos veces sin necesidad de guardar quien respondio que.
- **Anonimato por construccion.** Cuando la encuesta es anonima, la respuesta se guarda con `employee_id` e `invitation_id` en nulo y solo conserva el segmento. No queda en la base ningun camino de la respuesta a la persona; el esquema lo deja escrito en el modelo.
- **Cada respuesta se guarda tres veces segun su forma.** El valor crudo va en JSON, el numerico en `numeric_value` cuando el valor es un numero o una cadena convertible, y el texto en `text_value` cuando no lo es. Esa separacion es la que permite promediar y contar sin volver a interpretar el JSON.
- **Umbral minimo por segmento.** Un segmento con menos respuestas que `min_segment_responses` se devuelve marcado como oculto, con cero respuestas y sin promedio. Existe porque un corte con dos o tres personas deja de ser un agregado: quien conoce el area puede deducir quien respondio que, y eso rompe el anonimato que se le prometio al colaborador. El valor por defecto es `SURVEY_ANONYMITY_THRESHOLD`, cinco respuestas, y se puede fijar entre 1 y 100 al crear la encuesta. El catalogo de errores define `SURVEY_THRESHOLD_NOT_MET`, pero el servicio no lo lanza: prefiere ocultar el segmento antes que fallar la consulta.
- **Participacion sobre invitados.** Es el porcentaje de respuestas completas sobre las invitaciones; si no hay invitaciones, se usa el numero de respuestas como base para no dividir por cero.
- **eNPS con la regla estandar.** Sobre la pregunta de tipo `nps`: promotores son los puntajes de 9 o mas, detractores los de 6 o menos, y el indicador es la diferencia de porcentajes. Solo se calcula si hay una pregunta de ese tipo con respuestas.
- **Indice de clima.** Promedio de las preguntas likert con promedio disponible, dividido entre 5 y llevado a 100.
- **Respuestas abiertas acotadas.** Los resultados por pregunta devuelven como maximo 200 textos por pregunta abierta.
- **Nube de palabras simple.** El analisis de texto normaliza, quita acentos, descarta palabras de tres letras o menos y una lista de palabras vacias en espanol e ingles, y devuelve las 60 mas frecuentes. El comentario del servicio deja este punto como el lugar donde se conectaria un modelo de lenguaje.
- **Cerrar y archivar son distintos.** Cerrar pone el estado en `closed` y fija `closes_at`; archivar es borrado logico y saca la encuesta de todas las consultas.
- **Sin colaborador no hay bandeja.** `GET /surveys/mine` devuelve una lista vacia si el usuario no esta vinculado a un colaborador.

## Datos

| Tabla | Que guarda |
|---|---|
| `survey_templates` | Plantillas de cuestionario; las de la empresa y las del sistema, que tienen `company_id` nulo |
| `surveys` | Titulo, tipo, estado, si es anonima, umbral minimo por segmento, apertura, cierre, recurrencia, dias de recordatorio y version vigente |
| `survey_versions` | El esquema completo de cada version del cuestionario |
| `survey_questions` | Preguntas materializadas de una version: clave, etiqueta, tipo, dimension, posicion, obligatoriedad y configuracion |
| `survey_audiences` | A quien se dirige la encuesta: tipo de destino, id y filtros |
| `survey_invitations` | Invitacion por colaborador: token, envio, apertura, respuesta, recordatorios y el segmento congelado |
| `survey_responses` | Respuesta: encuesta, version, segmento, si esta completa y cuando se envio; colaborador e invitacion en nulo si es anonima |
| `survey_answers` | Respuesta por pregunta, con el valor en JSON, su version numerica y su version de texto |

Ninguna columna de este modulo va cifrada: no hay campos `/// Encrypted` en el
esquema ni llamadas de cifrado en el servicio. El servicio de cifrado se usa solo
para generar el token aleatorio de cada invitacion. La proteccion del dato aqui
no es el cifrado sino la ausencia de vinculo: en una encuesta anonima la relacion
entre persona y respuesta nunca se escribe.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/surveys` | Encuestas y clima | Ver las encuestas con participacion y umbral, crear, publicar y entrar a resultados; arriba, las encuestas propias pendientes |
| `/surveys/mine` | Encuestas y clima | Misma pagina, alcanzada desde la notificacion de una encuesta nueva |
| `/surveys/:id/responder` | Titulo de la encuesta | Responder el cuestionario; avisa que la encuesta es anonima y exige las preguntas obligatorias antes de enviar |
| `/surveys/:id/resultados` | Titulo de la encuesta | Invitados, respuestas, participacion, eNPS o indice de clima, distribucion por pregunta, corte por segmento y nube de palabras |

La pantalla de resultados muestra el umbral de anonimato en su descripcion, para
que quien lee los datos sepa por que un segmento aparece vacio.

## Limites

- No liquida nomina ni lleva contabilidad. Registra y exporta.
- No exporta resultados a archivo: `surveys.result.export` existe en el catalogo, pero no hay endpoint.
- No edita el cuestionario despues de creado: el servicio sabe crear versiones nuevas, pero ninguna ruta lo expone.
- No administra plantillas: solo las lista.
- No envia recordatorios automaticos; `reminder_days` y `reminders_sent` se guardan, pero nada los procesa.
- No abre ni cierra la encuesta por fecha: `opensAt` y `closesAt` son informativos, el cambio de estado siempre es manual.
- No interpreta las respuestas abiertas: cuenta palabras, no analiza sentimiento ni resume.
- No permite responder por un enlace publico sin sesion: el token acompana a una invitacion, pero la ruta exige usuario autenticado con permiso.
