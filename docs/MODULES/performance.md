# Desempeno

Junta lo que la empresa espera con lo que efectivamente pasa: objetivos con
resultados clave medibles, ciclos de evaluacion, calibracion en matriz 9-box,
feedback continuo, reuniones 1:1 y planes de desarrollo. Lo usan Talento
Humano para abrir y cerrar ciclos, los jefes para evaluar y hacer seguimiento,
y cada colaborador para su autoevaluacion y sus objetivos.

## Que hace

- Mantiene el diccionario de competencias con sus niveles y las asocia a cargos.
- Define ciclos de objetivos y un arbol de objetivos de empresa, area y persona.
- Calcula el avance de cada objetivo a partir de sus resultados clave, ponderado por peso.
- Registra check-ins de resultado clave con valor, confianza y comentario.
- Crea ciclos de evaluacion de 90, 180 y 360 grados y genera la matriz de evaluadores.
- Avanza el ciclo por etapas: borrador, autoevaluacion, evaluacion, calibracion, reunion de retroalimentacion y cierre.
- Recibe las respuestas del evaluador y calcula su nota promedio.
- Arma el informe individual: nota por relacion, brechas de competencia contra el perfil del cargo, objetivos y ubicacion en 9-box.
- Ubica colaboradores en la matriz 9-box durante la calibracion.
- Registra feedback continuo entre colaboradores, incluido el que alguien pide sobre si mismo.
- Agenda reuniones 1:1 y lleva planes de desarrollo con sus acciones.
- Define rutas de carrera y planes de sucesion de cargos criticos.
- Calcula indicadores: objetivos activos, avance promedio, ciclos abiertos, cumplimiento de evaluaciones y planes de desarrollo activos.

## Permisos

| Permiso | Para que |
|---|---|
| `performance.competency.manage` | Administrar el diccionario de competencias y sus niveles |
| `performance.objective.read` | Ver competencias, ciclos de objetivos, el arbol de objetivos y los indicadores |
| `performance.objective.create` | Crear ciclos de objetivos y objetivos |
| `performance.objective.update` | Editar un objetivo |
| `performance.objective.delete` | Eliminar un objetivo |
| `performance.checkin.create` | Registrar un check-in de resultado clave |
| `performance.cycle.read` | Ver ciclos de evaluacion |
| `performance.cycle.create` | Crear un ciclo de evaluacion |
| `performance.cycle.update` | Generar la matriz de evaluadores y avanzar la etapa |
| `performance.cycle.close` | Cerrar un ciclo |
| `performance.review.read` | Ver las evaluaciones propias y el informe individual |
| `performance.review.respond` | Enviar las respuestas de una evaluacion |
| `performance.review.calibrate` | Calibrar evaluaciones |
| `performance.ninebox.read` | Ver la matriz 9-box del ciclo |
| `performance.ninebox.update` | Ubicar a un colaborador en la matriz |
| `performance.feedback.read` | Ver el feedback recibido |
| `performance.feedback.create` | Dar feedback a otro colaborador |
| `performance.oneonone.read`, `performance.oneonone.create`, `performance.oneonone.update` | Reuniones 1:1 |
| `performance.developmentplan.read`, `performance.developmentplan.create`, `performance.developmentplan.update` | Planes de desarrollo individual |
| `performance.career.manage` | Administrar y consultar rutas de carrera |
| `performance.succession.read` | Ver planes de sucesion |
| `performance.succession.manage` | Definir el plan de sucesion de un cargo |

## Endpoints

Prefijo `/performance`.

### Competencias y objetivos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/performance/competencies` | Diccionario de competencias |
| POST | `/performance/competencies` | Crea una competencia con sus niveles |
| GET | `/performance/objective-cycles` | Ciclos de objetivos |
| POST | `/performance/objective-cycles` | Crea un ciclo de objetivos |
| GET | `/performance/objectives` | Arbol de objetivos alineados |
| POST | `/performance/objectives` | Crea un objetivo con sus resultados clave |
| PATCH | `/performance/objectives/:id` | Actualiza el objetivo y sus resultados clave |
| DELETE | `/performance/objectives/:id` | Elimina un objetivo |
| POST | `/performance/checkins` | Registra un check-in de resultado clave |

### Ciclos de evaluacion y calibracion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/performance/cycles` | Ciclos de evaluacion |
| POST | `/performance/cycles` | Crea un ciclo 90, 180 o 360 |
| POST | `/performance/cycles/:id/generate-assignments` | Genera la matriz de evaluadores |
| PATCH | `/performance/cycles/:id/status` | Avanza la etapa del ciclo |
| GET | `/performance/assignments/mine` | Evaluaciones pendientes del usuario |
| POST | `/performance/assignments/:id/submit` | Envia las respuestas |
| GET | `/performance/cycles/:cycleId/report/:employeeId` | Informe individual del ciclo |
| GET | `/performance/cycles/:id/nine-box` | Matriz 9-box del ciclo |
| POST | `/performance/nine-box` | Ubica a un colaborador en la matriz |

### Desarrollo y sucesion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/performance/feedback` | Feedback continuo recibido |
| POST | `/performance/feedback` | Da feedback a otro colaborador |
| GET | `/performance/one-on-ones` | Reuniones 1:1 |
| POST | `/performance/one-on-ones` | Agenda una reunion 1:1 |
| GET | `/performance/development-plans` | Planes de desarrollo individual |
| POST | `/performance/development-plans` | Crea un plan con sus acciones |
| GET | `/performance/career-paths` | Rutas de carrera |
| GET | `/performance/succession` | Planes de sucesion de cargos criticos |
| POST | `/performance/succession` | Define el plan de sucesion de un cargo |
| GET | `/performance/metrics` | Indicadores de desempeno |

## Reglas de negocio

- **Avance del objetivo, ponderado y acotado.** Cada resultado clave aporta la fraccion recorrida entre su valor inicial y su meta, limitada entre 0 y 100 por ciento, multiplicada por su peso. Cuando inicio y meta coinciden, el resultado clave vale 1 si el valor actual alcanzo la meta y 0 si no; asi un indicador binario no rompe la division. El avance final es la suma ponderada sobre la suma de pesos.
- **Guardar un objetivo sincroniza sus resultados clave.** Los que llegan con id se actualizan, los que no, se crean, y los que ya no aparecen en la lista se borran. Es un reemplazo completo, no un agregado.
- **Un check-in mueve el valor actual.** Registra la medicion con su nivel de confianza, actualiza el valor y la confianza del resultado clave y recalcula el avance del objetivo.
- **Matriz de evaluadores segun el tipo de ciclo.** Todo colaborador activo recibe siempre su autoevaluacion y, si tiene jefe, la evaluacion de su jefe. En ciclos de 180 y 360 se agregan pares de su misma area, como maximo tres por persona salvo que se pida otro numero. En los de 360 se agregan ademas sus reportes directos. La generacion es idempotente: la asignacion es unica por ciclo, evaluado, evaluador y relacion, asi que volver a generarla no duplica.
- **Solo el evaluador asignado responde.** Cualquier otro usuario recibe `FORBIDDEN`, salvo el superadministrador.
- **Un ciclo cerrado no admite respuestas** y devuelve `VALIDATION_FAILED`.
- **Las respuestas se guardan por clave de pregunta,** de modo que enviar dos veces actualiza en vez de duplicar. Al enviar, la nota general de esa evaluacion es el promedio de las respuestas que traen calificacion numerica; si ninguna la trae, queda sin nota.
- **Brechas de competencia contra el perfil del cargo.** El informe promedia las calificaciones por competencia de todas las evaluaciones del ciclo y las resta del nivel requerido por el cargo. Una brecha negativa marca lo que falta.
- **Numeracion de la matriz 9-box.** La casilla se calcula como `(potencial - 1) * 3 + desempeno`, con la 1 abajo a la izquierda y la 9 arriba a la derecha. La ubicacion es unica por ciclo y colaborador, asi que recalibrar sobrescribe.
- **Etapas del ciclo.** El estado solo avanza a uno de los seis valores permitidos: borrador, autoevaluacion, evaluacion, calibracion, reunion de retroalimentacion y cerrado.
- **Indicadores.** El cumplimiento de evaluaciones es el porcentaje de asignaciones enviadas sobre el total. Los ciclos activos excluyen los que estan en borrador y los cerrados.

## Datos

| Tabla | Que guarda |
|---|---|
| `competencies`, `competency_levels` | Diccionario de competencias y la descripcion de cada nivel |
| `position_competencies` | Nivel requerido de cada competencia por cargo |
| `objective_cycles` | Periodos de objetivos |
| `objectives` | Objetivo con su nivel, dueno, alineacion con el objetivo padre y avance calculado |
| `key_results` | Resultado clave: metrica, valor inicial, meta, valor actual, peso y confianza |
| `kr_checkins` | Cada medicion registrada, con confianza y comentario |
| `review_templates` | Formulario del ciclo, con preguntas de competencia y abiertas |
| `review_cycles` | Ciclo: tipo, etapa y fechas |
| `review_assignments` | Quien evalua a quien, con que relacion, su estado y su nota |
| `review_responses` | Respuesta por clave de pregunta, con calificacion, respuesta libre y comentario |
| `calibration_sessions` | Sesiones de calibracion |
| `nine_box_placements` | Desempeno, potencial, casilla resultante, quien calibro y sus notas |
| `feedback` | Feedback continuo; marca cuando fue pedido por quien lo recibe |
| `one_on_ones` | Reuniones 1:1 entre lider y colaborador |
| `development_plans`, `development_actions` | Plan de desarrollo y sus acciones |
| `career_paths`, `career_path_steps` | Rutas de carrera y sus pasos |
| `succession_plans`, `succession_candidates` | Cargos criticos y sus candidatos |

No hay columnas cifradas en este modulo.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/performance` | Objetivos y OKR | Arbol de objetivos de empresa, area y persona con resultados clave y check-ins |
| `/performance/ciclos` | Ciclos de evaluacion | Crear ciclos, generar evaluadores y avanzar etapas |
| `/performance/mis-evaluaciones` | Mis evaluaciones | Autoevaluacion y evaluaciones que el usuario debe responder |
| `/performance/nine-box/:cycleId` | Matriz 9-box | Ubicar y mover colaboradores durante la calibracion |
| `/performance/feedback` | Feedback continuo | Dar, pedir y consultar retroalimentacion |

## Limites

- No define aumentos, bonos ni compensacion variable: el desempeno se registra, la decision salarial ocurre fuera.
- No liquida nomina ni calcula incentivos economicos a partir de la nota.
- No garantiza el anonimato de pares y reportes directos en el informe individual: la nota se agrupa por relacion, pero el modelo guarda quien evaluo.
- No fuerza plazos de cierre ni cierra ciclos automaticamente; la etapa la mueve una persona.
- Las rutas de carrera y los planes de sucesion son registros: no promueven ni mueven a nadie de cargo, eso es un movimiento de personal.
