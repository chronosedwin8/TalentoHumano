# Analitica

Convierte lo que los demas modulos registran en indicadores, series y alertas.
Lo usa la gerencia para ver plantilla, rotacion y ausentismo del periodo, el jefe
para mirar su equipo y Talento Humano para armar reportes propios sobre fuentes
de datos acotadas y exportarlos. No hay SQL libre: el constructor trabaja sobre
un catalogo cerrado de datasets y cada uno exige el permiso de lectura del modulo
del que sale.

## Que hace

- Arma el tablero ejecutivo del periodo con once indicadores, distribuciones por area, sede y tipo de contrato, y demografia por genero, edad y antiguedad.
- Entrega al jefe el tablero de su equipo con ausencias del mes, avance de objetivos, evaluaciones y formacion.
- Devuelve la serie historica de plantilla de los ultimos meses.
- Toma un snapshot diario de plantilla por total, area, sede y banda de antiguedad, que es lo que alimenta la serie.
- Genera alertas de documentos, contratos y examenes medicos por vencer, y de acumulacion de vacaciones.
- Calcula un riesgo de rotacion por colaborador con una heuristica de senales, y lo guarda como alerta.
- Publica un catalogo de datasets seguros con sus columnas.
- Permite construir un reporte eligiendo fuente, columnas, filtros y agrupacion, y ejecutarlo al vuelo.
- Guarda, ejecuta, exporta a CSV y elimina definiciones de reporte, propias o compartidas.
- Registra cada ejecucion de un reporte guardado con su numero de filas.
- Guarda la programacion de envio periodico de un reporte (cron, formato y destinatarios).

## Permisos

| Permiso | Para que |
|---|---|
| `analytics.dashboard.read` | Ver el tablero ejecutivo, la serie de plantilla y lanzar el snapshot diario |
| `analytics.report.read` | Ver el catalogo de datasets y los reportes guardados |
| `analytics.report.create` | Guardar una definicion de reporte |
| `analytics.report.update` | Declarado en el catalogo; hoy ningun endpoint lo exige |
| `analytics.report.delete` | Eliminar logicamente un reporte guardado |
| `analytics.report.run` | Ejecutar un reporte, ad hoc o guardado |
| `analytics.schedule.manage` | Programar el envio periodico de un reporte |
| `analytics.alert.read` | Ver las alertas activas y el riesgo de rotacion |
| `analytics.alert.manage` | Recalcular las alertas y marcarlas como resueltas |
| `analytics.export.execute` | Exportar un reporte guardado a CSV |

El tablero de equipo es la excepcion: `/analytics/team` exige
`dashboard.team.read`, que pertenece al modulo Dashboard y no a este catalogo.

## Endpoints

Prefijo `/analytics`. Todo el controlador exige que el modulo `analytics` este
activo para la empresa y asignado al usuario; si no, la respuesta es
`MODULE_DISABLED` (403).

### Tableros y series

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/analytics/executive` | Tablero ejecutivo con KPIs, distribuciones, demografia y serie de plantilla |
| GET | `/analytics/team` | Tablero del jefe con su equipo |
| GET | `/analytics/headcount-series` | Serie de plantilla de los ultimos `months` (12 por defecto) |
| POST | `/analytics/snapshots/run` | Ejecuta el snapshot diario de plantilla |

### Alertas y prediccion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/analytics/alerts` | Alertas sin resolver, filtrables por tipo |
| POST | `/analytics/alerts/run` | Recalcula alertas de vencimiento y riesgo de rotacion |
| GET | `/analytics/turnover-risk` | Riesgo de rotacion por colaborador |
| POST | `/analytics/alerts/:id/resolve` | Marca una alerta como resuelta |

### Constructor de reportes

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/analytics/datasets` | Catalogo de datasets con sus columnas |
| GET | `/analytics/reports` | Reportes guardados propios o compartidos |
| POST | `/analytics/reports` | Guarda una definicion de reporte |
| POST | `/analytics/reports/run` | Ejecuta un reporte ad hoc sin guardarlo |
| GET | `/analytics/reports/:id/run` | Ejecuta un reporte guardado y registra la corrida |
| GET | `/analytics/reports/:id/export` | Exporta el reporte guardado a CSV |
| DELETE | `/analytics/reports/:id` | Borrado logico del reporte guardado |
| POST | `/analytics/reports/:id/schedule` | Guarda la programacion de envio del reporte |

## Reglas de negocio

### Datasets del constructor

Son seis, fijos en el codigo. Cada uno declara su etiqueta, sus columnas y el
permiso que hay que tener para consultarlo:

| Dataset | Permiso exigido | Columnas |
|---|---|---|
| `employees` | `people.employee.read` | Codigo, nombre, correo, estado, ingreso, retiro, area, cargo, sede, genero, modalidad y antiguedad |
| `leaves` | `leaves.request.read` | Colaborador, tipo, inicio, fin, dias y estado |
| `attendance` | `time.attendance.read` | Colaborador, fecha, estado, minutos trabajados, de retardo y extra |
| `enrollments` | `learning.progress.read` | Colaborador, curso, estado, avance, calificacion y finalizacion |
| `applications` | `recruiting.application.read` | Candidato, vacante, etapa, estado, fuente y fecha de postulacion |
| `tickets` | `helpdesk.ticket.read` | Numero, asunto, categoria, estado, prioridad, creacion y resolucion |

### Como se construye y se ejecuta un reporte

- **El permiso del dataset se verifica en cada corrida.** Antes de consultar nada, el servicio llama `requirePermission` con el permiso del dataset; si el usuario no lo tiene, responde `PERMISSION_DENIED` (403) indicando cual. Tener `analytics.report.run` no alcanza: hay que poder leer la fuente.
- **El alcance efectivo es la empresa.** Las consultas filtran por `companyId` y por borrado logico, no por el alcance de datos del grant (`own`, `team`, `area`). La puerta es el permiso del modulo de origen, no el subconjunto de colaboradores que el usuario ve en ese modulo.
- **Nada de SQL del cliente.** El nombre del dataset se resuelve contra el catalogo y cada uno tiene su consulta Prisma fija. Una columna que no exista en el resultado sale en `null` en vez de tocar la base.
- **Tope de filas.** Cada dataset trae como maximo 10.000 filas.
- **Los filtros solo aplican a `employees`.** Se honran `status`, `departmentId` y `locationId`; los demas datasets ignoran lo que se envie en `filters`.
- **Agrupar cambia la forma del resultado.** Con `groupBy` se devuelve una fila por combinacion con la columna `total` y el conteo; sin el, se devuelven las columnas pedidas, o todas las del dataset si no se pidio ninguna.
- **Dataset invalido.** Al guardar una definicion se responde `VALIDATION_FAILED` (422). Al ejecutar, el servicio lanza un error generico, que sale como error no controlado.
- **Visibilidad de lo guardado.** La lista solo devuelve los reportes creados por el usuario o marcados como compartidos.
- **Solo la corrida de un reporte guardado se registra** en `report_runs`, con estado `success` y el numero de filas. Las corridas ad hoc no dejan registro.
- **Exportacion.** El CSV usa punto y coma, reemplaza por comas los que vengan en el contenido y va precedido de un BOM para que Excel lo abra como UTF-8.

### Indicadores del tablero ejecutivo

El periodo va del 1 de enero del ano en curso a hoy, salvo que se envien `from` y
`to`. Los filtros por area, sede, cargo y genero se aplican a las cifras basadas
en colaboradores.

- Rotacion = retiros del periodo / plantilla promedio x 100, donde la plantilla promedio es `activos + retiros / 2`. La rotacion voluntaria usa el mismo denominador contando solo los retiros por `renuncia` o `mutuo_acuerdo`.
- Ausentismo = dias de ausencias `approved` o `taken` iniciadas en el periodo / dias laborables x 100, donde los dias laborables son `activos x semanas del periodo x 5`.
- Formacion obligatoria al dia = inscripciones completadas en cursos obligatorios sobre el total; si no hay cursos obligatorios devuelve 100.
- Se cuentan ademas ingresos, retiros, vacantes publicadas, tickets abiertos (`new`, `open`, `on_hold`), denuncias en curso (`received`, `triaged`, `in_investigation`) y documentos que vencen en 30 dias.
- Los denominadores caen a 1 cuando darian cero, para no dividir por cero.
- Los indicadores que conviene bajar van marcados con `inverse`, y de ahi salen los colores de la pantalla.

### Serie historica y snapshots

- **La serie sale de `hr_snapshots`.** Se leen las filas de metrica `headcount`, dimension `total`, desde hoy menos los meses pedidos, ordenadas por fecha, y se etiquetan por `ano-mes`.
- **Si todavia no hay snapshots, la serie se reconstruye** contando, mes a mes, los colaboradores con ingreso anterior al cierre del mes y sin retiro o con retiro posterior. Es un respaldo para que el grafico no aparezca vacio el primer dia; a partir del primer snapshot manda la tabla.
- **El snapshot es idempotente.** Escribe con `upsert` sobre la clave `(empresa, fecha, metrica, dimension, valor de dimension)`, asi que volver a lanzarlo el mismo dia corrige el dato en vez de duplicarlo. En cada corrida guarda el total, el desglose por area, por sede y por banda de antiguedad, contando como activos a quienes ingresaron hasta ese dia y no se habian retirado.
- **Nadie lo lanza solo.** No hay ningun `@Cron` en la API, asi que el snapshot hay que dispararlo con `POST /analytics/snapshots/run`.

### Alertas y riesgo de rotacion

- **Alertas de vencimiento.** Con un horizonte de 30 dias se revisan documentos del legajo, contratos vigentes con fecha de fin, examenes medicos y saldos de vacaciones del ano. El saldo genera alerta cuando el disponible supera el umbral de la politica, o 30 dias si el saldo no tiene politica asociada.
- **No se duplican.** Antes de crear una alerta se busca una del mismo tipo y la misma entidad sin resolver; si existe, no se crea otra. Recalcular varias veces al dia no llena la bandeja.
- **Topes por corrida:** 200 documentos, 200 contratos, 200 examenes y 500 saldos.
- **Riesgo de rotacion: una heuristica sumatoria** sobre hasta 2.000 colaboradores activos. Suma 25 puntos por mas de 20 dias de ausencia en doce meses, 25 por mas de tres anos sin movimiento de promocion, 15 por no haber completado formacion en doce meses, 15 por no haber recibido reconocimientos en doce meses y 10 por antiguedad menor a un ano. Solo se reporta desde 40 puntos, el puntaje se limita a 100 y la severidad es alta desde 70. Cada caso llega con las razones que lo explican.
- **Los 200 primeros se persisten** como alertas de tipo `turnover_risk`, para que aparezcan en la bandeja y se puedan resolver. El comentario del codigo lo dice sin rodeos: es una senal para abrir una conversacion, nunca una decision automatica.
- **La bandeja solo muestra lo no resuelto.** Resolver sella `is_resolved` y `resolved_at`.

## Datos

| Tabla | Que guarda |
|---|---|
| `hr_snapshots` | Un valor por empresa, fecha, metrica, dimension y valor de dimension; es la tabla de hechos que sostiene las series |
| `report_definitions` | Nombre, descripcion, dataset, columnas, filtros, agrupacion, tipo de grafico y si es compartido |
| `report_schedules` | Cron, formato, destinatarios, si esta activa y las marcas de ultima y proxima ejecucion |
| `report_runs` | Estado, formato, filas, archivo, error y tiempos de cada corrida de un reporte guardado |
| `analytics_alerts` | Tipo, severidad, titulo, detalle, entidad referida, puntaje, vencimiento y estado de resolucion |

Ninguna columna de este modulo va cifrada: no se guardan datos personales
sensibles aqui. Lo que se persiste son agregados, definiciones de reporte y
referencias a otras entidades por su identificador. Los valores de
`hr_snapshots` usan `Decimal(16,4)` y los puntajes de alerta `Decimal(6,2)`.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/analytics` | Analitica de talento humano | Tarjetas de KPI, rango de fechas y pestanas Plantilla, Demografia, Alertas y Riesgo de rotacion |
| `/analytics/reportes` | Constructor de reportes | Elegir fuente, columnas y agrupacion, ejecutar, guardar, exportar a CSV y eliminar |

Las pestanas de Alertas y Riesgo de rotacion aparecen con
`analytics.alert.read`. El enlace al constructor se muestra con
`analytics.report.read`. Los endpoints de tablero de equipo, serie de plantilla,
snapshot y programacion de envios no tienen pantalla propia.

## Limites

- No liquida nomina ni lleva contabilidad: no hay importes en ningun indicador ni en ningun dataset.
- La programacion de reportes se guarda pero no se ejecuta: no existe ningun proceso que corra el cron ni que envie correos con el archivo.
- El snapshot diario tampoco corre solo; hay que invocarlo.
- La exportacion siempre produce CSV, aunque la programacion acepte `xlsx`, `csv` o `pdf` y la tabla de corridas tenga una columna de formato.
- El riesgo de rotacion es una suma de senales configurada en el codigo, no un modelo entrenado ni una prediccion estadistica, y no se puede ajustar sin cambiar el codigo.
- El constructor no permite consultas libres, ni combinar datasets, ni columnas calculadas: solo elegir columnas, filtrar en `employees` y agrupar contando.
- Los reportes no reducen las filas al alcance de datos del usuario; controlan el acceso por permiso de modulo.
- No es un almacen de datos historico: fuera de `hr_snapshots`, cada consulta lee el estado actual de las tablas de origen, no una foto del pasado.
