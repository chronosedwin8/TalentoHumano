# Ingreso y salida

Convierte el ingreso y el retiro de una persona en una lista de tareas con
responsable y fecha, en vez de un correo con instrucciones. Talento Humano
define las plantillas, el sistema abre el proceso solo cuando alguien es
contratado, y cada responsable ve lo suyo.

## Que hace

- Define plantillas de ingreso y de salida con tareas ordenadas, responsable por rol y fecha relativa al dia de referencia.
- Abre el proceso de ingreso automaticamente cuando reclutamiento contrata a alguien.
- Elige la plantilla mas especifica que aplique al colaborador: por cargo, por area, por sede, o la predeterminada.
- Asigna cada tarea segun el tipo de responsable definido en la plantilla.
- Calcula el avance del proceso sobre las tareas obligatorias y marca los procesos atrasados.
- Muestra un tablero con todos los procesos abiertos y sus tareas vencidas.
- Da al nuevo colaborador un portal de pre-ingreso accesible con enlace temporal, antes del primer dia.
- Envia recordatorios de tareas vencidas o por vencer, con tope de reintentos.
- Registra entrevistas de retiro con motivo, recomendacion y NPS.
- Al terminar un proceso de salida, inactiva al colaborador.

## Permisos

| Permiso | Para que |
|---|---|
| `onboarding.template.read` | Ver plantillas de ingreso y salida |
| `onboarding.template.create` | Crear una plantilla con sus tareas |
| `onboarding.template.update` | Editar una plantilla y reemplazar sus tareas |
| `onboarding.template.delete` | Eliminar una plantilla |
| `onboarding.process.read` | Ver procesos, el tablero y el detalle |
| `onboarding.process.create` | Iniciar manualmente un proceso |
| `onboarding.process.update` | Editar un proceso y lanzar la corrida de recordatorios |
| `onboarding.process.delete` | Eliminar un proceso |
| `onboarding.task.read` | Ver las tareas propias |
| `onboarding.task.update` | Editar una tarea del proceso |
| `onboarding.task.complete` | Marcar una tarea como completada |
| `onboarding.offboarding.read`, `onboarding.offboarding.create`, `onboarding.offboarding.update`, `onboarding.offboarding.delete` | Procesos de salida |
| `onboarding.exitinterview.read` | Ver entrevistas de retiro |
| `onboarding.exitinterview.create` | Registrar una entrevista de retiro |

## Endpoints

Prefijo `/onboarding`.

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/onboarding/templates` | Plantillas de ingreso y salida |
| POST | `/onboarding/templates` | Crea una plantilla con sus tareas |
| PATCH | `/onboarding/templates/:id` | Actualiza la plantilla y reemplaza sus tareas |
| DELETE | `/onboarding/templates/:id` | Elimina una plantilla |
| GET | `/onboarding/processes` | Procesos de ingreso o salida |
| GET | `/onboarding/board` | Tablero de progreso, por tipo de proceso |
| GET | `/onboarding/processes/:id` | Detalle del proceso con sus tareas |
| POST | `/onboarding/processes` | Inicia manualmente un proceso |
| GET | `/onboarding/tasks/mine` | Tareas asignadas al usuario |
| POST | `/onboarding/tasks/:id/complete` | Completa una tarea |
| PATCH | `/onboarding/tasks/:id` | Actualiza una tarea |
| POST | `/onboarding/exit-interviews` | Registra la entrevista de retiro |
| GET | `/onboarding/exit-interviews` | Entrevistas de retiro registradas |
| GET | `/onboarding/preboarding/:token` | Portal de pre-ingreso, sin sesion |
| POST | `/onboarding/reminders/run` | Envia recordatorios de tareas |

## Reglas de negocio

- **El proceso lo abre la contratacion, no una persona.** El modulo escucha el evento `employee.hired` y arranca el ingreso con la fecha de contratacion como fecha de referencia. Si algo falla, se registra en el log y la contratacion no se deshace: ya hay un colaborador creado, y es preferible un proceso faltante que una contratacion a medias.
- **El manejador se espera a proposito.** No esta marcado como asincrono, de modo que la respuesta de la contratacion ya refleja el proceso creado: el reclutador aterriza en el nuevo colaborador y ve las tareas, no una pantalla vacia.
- **Plantilla por especificidad.** Si no se indica una, se busca entre las plantillas activas del tipo pedido y se toma, en este orden, la que coincide con el cargo, con el area, con la sede, la marcada como predeterminada, y como ultimo recurso la primera. Asi una empresa puede tener una plantilla general y afinarla para un cargo concreto sin duplicar todo.
- **Fechas relativas al dia de referencia.** Cada tarea de la plantilla lleva un `offset_days` que se suma a la fecha de referencia. Un valor negativo sirve para tareas de pre-ingreso, antes del primer dia.
- **Responsable resuelto al crear el proceso.** Si el tipo de responsable es `employee`, la tarea queda del colaborador; si es `manager`, de su jefe; en los demas casos se usa el usuario fijo que trae la plantilla. La resolucion se hace una sola vez, al abrir el proceso, no al consultarlo.
- **Dependencias entre tareas.** Si una tarea depende de otra y esa otra no esta completada, completar falla con `VALIDATION_FAILED` y el mensaje nombra la tarea bloqueante.
- **Avance solo sobre lo obligatorio.** El porcentaje se calcula con las tareas marcadas como requeridas; si no hay ninguna, el proceso arranca en 100. Cualquier tarea sin completar con fecha vencida pone el proceso en `overdue`. Al llegar a 100 pasa a `completed` y se sella la fecha.
- **Completar una salida inactiva al colaborador.** Cuando un proceso de tipo `offboarding` llega al 100 por ciento, el colaborador pasa a `inactive`. Es la contraparte del retiro que se registra desde la ficha.
- **Token de pre-ingreso solo para ingresos.** Los procesos de salida nacen sin token. El portal de pre-ingreso muestra unicamente las tareas cuyo responsable es el propio colaborador, mas los datos de la empresa y de su cargo.
- **Recordatorios acotados.** Se envian a tareas pendientes o en curso que vencen dentro de un dia o ya vencieron, con menos de tres recordatorios enviados y con responsable que tenga usuario. Cada corrida procesa hasta 200 tareas y aumenta el contador. El tope evita convertir el recordatorio en spam.

## Datos

| Tabla | Que guarda |
|---|---|
| `onboarding_templates` | Plantilla por tipo, con el cargo, area o sede al que aplica y si es la predeterminada |
| `onboarding_template_tasks` | Tareas modelo: titulo, tipo de responsable, tipo de tarea, `offset_days`, orden, dependencia y los recursos vinculados (curso, formulario, tipo de documento, politica) |
| `onboarding_processes` | Proceso abierto: tipo, estado, fecha de referencia, avance, padrino, motivo de salida y token de pre-ingreso |
| `onboarding_tasks` | Tarea real del proceso, con su responsable resuelto, vencimiento, estado, resultado en JSON y recordatorios enviados |
| `exit_interviews` | Entrevista de retiro: motivo, si recomendaria la empresa, NPS, resumen y el formulario respondido |

No hay columnas cifradas en este modulo. El token de pre-ingreso se guarda en
claro porque es el propio enlace de acceso y es de un solo proceso.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/onboarding` | Ingreso y salida | Tablero de progreso con tareas, responsables y vencimientos |
| `/onboarding/plantillas` | Plantillas de ingreso y salida | Armar la lista de tareas con responsable, tipo y fecha relativa |
| `/onboarding/procesos/:id` | Proceso | Detalle del proceso de un colaborador y sus tareas |
| `/pre-ingreso/:token` | Pre-ingreso | El nuevo colaborador ve sus tareas antes del primer dia, sin sesion |
| `/portal/tareas` | Mis tareas | Las tareas de ingreso asignadas al usuario |

## Limites

- No liquida ni paga nada del retiro: la liquidacion es del sistema de nomina.
- No entrega equipos ni da de alta accesos por si mismo: crea la tarea y registra que se cumplio. La entrega de activos se registra en el modulo de personal.
- No decide quien aprueba nada: el ingreso y la salida no pasan por el motor de flujos, son listas de tareas.
- El portal de pre-ingreso es de solo lectura sobre el proceso; no permite editar la ficha del colaborador.
- Los recordatorios no escalan al jefe ni reabren tareas vencidas; solo avisan, y como maximo tres veces.
