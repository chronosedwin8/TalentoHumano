# Tiempo y asistencia

Registra cuando la gente entra, sale y descansa, y a partir de esas marcaciones
arma el dia de asistencia. Lo usa el colaborador para marcar desde la web o el
celular, el jefe para revisar su equipo, y Talento Humano para corregir,
justificar y sacar indicadores de puntualidad y ausentismo.

## Que hace

- Registra marcaciones de entrada, salida, inicio y fin de descanso, desde la web, el celular, un reloj biometrico o cargadas a mano.
- Valida la secuencia de marcaciones y rechaza duplicados inmediatos.
- Verifica que la marcacion desde el celular ocurra dentro de una geocerca de la sede.
- Recalcula el dia de asistencia cada vez que entra una marcacion: minutos trabajados, de descanso, de tardanza, de salida anticipada y de exceso sobre el horario.
- Deduce el estado del dia cruzando marcaciones, horario, festivos y ausencias aprobadas.
- Define horarios semanales por regla de dia y los asigna a colaboradores con vigencia.
- Planifica turnos y los asigna de forma masiva, con grilla semanal.
- Gestiona solicitudes de intercambio de turno entre companeros.
- Permite justificar inconsistencias y aprobarlas o rechazarlas.
- Registra dispositivos de marcacion con token propio e ingesta sus lecturas.
- Importa marcaciones desde un archivo ya procesado.
- Calcula indicadores de puntualidad, ausentismo, horas trabajadas y horas en exceso.

## Permisos

| Permiso | Para que |
|---|---|
| `time.clock.create` | Marcar la propia jornada |
| `time.clock.read` | Ver las marcaciones propias del dia |
| `time.attendance.read` | Ver la asistencia diaria, limitada por el alcance |
| `time.attendance.update` | Corregir un dia, marcar por otra persona y recalcular un rango |
| `time.justification.create` | Justificar una inconsistencia |
| `time.justification.approve` | Ver y decidir justificaciones |
| `time.schedule.manage` | Crear horarios y asignarlos |
| `time.shift.read` | Ver horarios, turnos y la grilla del planificador |
| `time.shift.create` | Crear un turno |
| `time.shift.update` | Asignar turnos de forma masiva |
| `time.shift.delete` | Eliminar un turno |
| `time.shift.publish` | Publicar la programacion de turnos |
| `time.swap.request` | Solicitar un intercambio de turno |
| `time.swap.approve` | Decidir un intercambio de turno |
| `time.device.manage` | Dispositivos, geocercas e importacion de marcaciones |
| `time.report.read` | Ver los indicadores de asistencia |
| `time.report.export` | Exportar los reportes de asistencia |

## Endpoints

Prefijo `/time`.

### Marcacion y asistencia

| Metodo | Ruta | Que hace |
|---|---|---|
| POST | `/time/clock` | Marcacion del colaborador autenticado |
| POST | `/time/clock/:employeeId` | Marcacion manual registrada por Talento Humano |
| GET | `/time/clock/today` | Marcaciones propias del dia |
| GET | `/time/attendance` | Asistencia diaria calculada, con filtros de rango, area y estado |
| GET | `/time/attendance/summary` | Indicadores de puntualidad y ausentismo |
| PATCH | `/time/attendance/:id` | Correccion manual de un dia |
| POST | `/time/attendance/:employeeId/recompute` | Recalcula un rango de fechas |
| POST | `/time/justifications` | Justifica una inconsistencia |
| GET | `/time/justifications` | Justificaciones pendientes |
| POST | `/time/justifications/:id/decide` | Aprueba o rechaza una justificacion |

### Horarios, turnos y dispositivos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/time/schedules` | Horarios de trabajo |
| POST | `/time/schedules` | Crea un horario semanal con sus reglas |
| POST | `/time/schedules/:id/assign` | Asigna el horario a colaboradores |
| GET | `/time/shifts` | Turnos definidos |
| POST | `/time/shifts` | Crea un turno |
| GET | `/time/shifts/planner` | Grilla de turnos asignados en un rango |
| POST | `/time/shifts/assign` | Asignacion masiva de turnos |
| POST | `/time/shifts/swap` | Solicita un intercambio de turno |
| POST | `/time/shifts/swap/:id/decide` | Decide el intercambio |
| GET | `/time/devices` | Dispositivos registrados |
| POST | `/time/devices` | Registra un dispositivo y devuelve su token una sola vez |
| POST | `/time/devices/ingest` | Ingesta desde relojes biometricos, autenticada por token de dispositivo |
| POST | `/time/import` | Importa marcaciones ya procesadas |
| GET | `/time/geofences` | Geocercas por sede |
| POST | `/time/geofences` | Crea una geocerca |
| DELETE | `/time/geofences/:id` | Elimina una geocerca |

## Reglas de negocio

- **Secuencia valida de marcaciones** (`CLOCK_SEQUENCE_INVALID`, 422). Despues de una entrada solo cabe una salida o un inicio de descanso; despues de un inicio de descanso, solo su fin; despues del fin de descanso, salida o nuevo descanso; despues de una salida, solo una nueva entrada. La primera marcacion del dia debe ser una entrada. El error devuelve en `details` la ultima marcacion y lo que si se acepta.
- **Duplicado inmediato** (`CLOCK_DUPLICATE`, 409). Dos marcaciones iguales separadas por menos de un minuto se rechazan. Es la defensa contra el doble toque en el celular o el doble paso por el lector.
- **Geocerca solo bloquea al celular** (`CLOCK_OUT_OF_GEOFENCE`, 422). Si llegan coordenadas, se comparan contra las geocercas activas de la sede del colaborador. Si no hay geocercas definidas, no se evalua nada y el resultado queda nulo. Estar fuera del area se registra siempre, pero solo corta la marcacion cuando el origen es `mobile`: una marcacion desde un reloj fijo o hecha a mano no deberia fallar por un GPS impreciso.
- **El dia de asistencia se recalcula, no se edita.** Cada marcacion vuelve a construir el registro del dia desde las marcaciones crudas. Los minutos trabajados son la diferencia entre la primera entrada y la ultima salida, menos los descansos emparejados.
- **Tolerancia del horario.** La tardanza se cuenta como los minutos de retraso que superen la tolerancia del horario. La salida anticipada y el exceso sobre el horario son el mismo calculo con signo contrario: lo que falto o lo que sobro frente a la hora de salida.
- **Estado del dia, por prioridad.** Ausencia aprobada, luego festivo, luego dia no laborable segun el horario, luego ausente si no hay marcaciones y la fecha ya paso (si aun no llega, queda pendiente), luego tarde, luego salida anticipada, y en ultimo lugar presente.
- **Horario efectivo.** Se busca la asignacion vigente del colaborador para esa fecha; si no tiene, se usa el horario predeterminado de la empresa. Dentro del horario se toma la regla del dia de la semana. Sin regla no hay horario y el dia no se evalua contra hora alguna.
- **Correccion manual conserva el original.** Corregir un dia cambia el estado, las notas o los minutos del registro calculado, pero no borra ni altera las marcaciones. La correccion queda auditada.
- **Ingesta de dispositivo autenticada por token.** El endpoint de ingesta no exige sesion: se autentica con el token del dispositivo, comparado contra su hash. Solo se aceptan dispositivos activos, y cada lote actualiza `last_seen_at`.
- **Ingesta idempotente.** Cada fila busca al colaborador por codigo o por documento; si no aparece, se salta y se reporta el error. Una marcacion identica en colaborador, instante y tipo se descarta como duplicada. Al final se recalcula una sola vez cada combinacion de colaborador y dia afectada, en vez de recalcular fila por fila.
- **Intercambio de turno.** Aprobar reasigna el turno del solicitante al companero objetivo. El sistema no verifica que el companero no tenga ya otro turno ese dia.
- **Indicadores.** La puntualidad se calcula como los dias presentes menos los tarde, sobre el total de dias del rango; el ausentismo, como los dias ausentes sobre ese mismo total. Ambos respetan el alcance de datos del usuario.

## Datos

| Tabla | Que guarda |
|---|---|
| `work_schedules`, `schedule_rules` | Horario con su tolerancia y una regla por dia de la semana: hora de entrada, de salida, descanso y si es laborable |
| `employee_schedules` | Asignacion de horario a un colaborador, con vigencia |
| `shifts`, `shift_assignments` | Turnos y su asignacion a personas y fechas |
| `shift_swap_requests` | Solicitud de intercambio: asignacion propia, companero objetivo, motivo y decision |
| `geofences` | Centro, radio en metros y sede de cada area permitida para marcar |
| `clock_devices` | Dispositivo, proveedor, serie, sede, `last_seen_at` y el hash de su token |
| `time_clock_entries` | Marcacion cruda: tipo, origen, instante, fecha local, coordenadas, precision, si estaba en geocerca, foto y notas |
| `attendance_days` | Dia calculado: estado, horario previsto, primera entrada, ultima salida y los minutos trabajados, de descanso, de tardanza, de salida anticipada y en exceso |
| `attendance_justifications` | Justificacion de una inconsistencia, con su decision |

No hay columnas cifradas en este modulo. El token del dispositivo se guarda
solo como hash y se muestra en claro una unica vez, al registrarlo. El esquema
marca los minutos en exceso como conteo informativo y nunca valorizado.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/time` | Marcacion | Registrar la jornada desde la web o el celular y ver las marcaciones del dia |
| `/time/asistencia` | Asistencia | Revisar el dia calculado por colaborador, corregir y justificar |
| `/time/turnos` | Planificador de turnos | Grilla semanal de turnos publicados |

## Limites

- No liquida nomina ni valoriza el tiempo. Los minutos en exceso son un conteo informativo; el recargo lo calcula el sistema de nomina.
- No aprueba horas extra: no hay un flujo de autorizacion previa ni un limite por colaborador.
- No hace control de acceso fisico: lee marcaciones de los dispositivos, no abre puertas ni molinetes.
- No reconoce rostros ni huellas; eso ocurre en el dispositivo, que envia la lectura ya identificada.
- El intercambio de turno no valida choques de agenda del companero que recibe el turno.
- Las tardanzas y ausencias no generan por si solas un proceso disciplinario; eso se registra aparte, en ausencias y novedades.
