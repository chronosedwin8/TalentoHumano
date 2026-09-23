# Ausencias y novedades

Centraliza todo lo que interrumpe o altera la jornada: vacaciones, permisos,
incapacidades y licencias, mas las novedades que Talento Humano registra para
el periodo. El colaborador solicita, el jefe aprueba y Talento Humano exporta
el resultado al sistema de nomina externo. La plataforma cuenta dias, nunca
dinero.

## Que hace

- Define tipos de ausencia con sus reglas propias: si requieren aprobacion, soporte, cobertura, si descuentan saldo, si cuentan dias habiles o calendario, anticipacion minima y maximo por solicitud.
- Calcula el saldo de vacaciones prorrateado al tiempo trabajado en el ano.
- Permite ajustar el saldo a mano, con motivo obligatorio y registro en auditoria.
- Recibe solicitudes de ausencia, valida las reglas del tipo y abre el flujo de aprobacion.
- Anula solicitudes y devuelve los dias al saldo.
- Muestra el calendario de ausencias del equipo o del area, con los festivos superpuestos.
- Administra el calendario de festivos, con carga automatica de los festivos de Colombia por ano.
- Marca los dias de asistencia afectados por una ausencia aprobada.
- Registra novedades del colaborador (eventos con codigo de nomina, cantidad y unidad).
- Lleva procesos disciplinarios con sus etapas, cifrados y con acceso trazado.
- Exporta ausencias, novedades y asistencia a nomina externa en CSV o JSON.

## Permisos

| Permiso | Para que |
|---|---|
| `leaves.type.manage` | Crear, editar y eliminar tipos de ausencia |
| `leaves.policy.manage` | Administrar politicas de vacaciones |
| `leaves.balance.read` | Ver saldos y politicas |
| `leaves.balance.adjust` | Ajustar manualmente el saldo de un colaborador |
| `leaves.request.read` | Ver solicitudes, calendario, tipos y festivos |
| `leaves.request.create` | Crear una solicitud, propia o de alguien en su alcance |
| `leaves.request.update` | Editar una solicitud |
| `leaves.request.cancel` | Anular una solicitud |
| `leaves.request.approve` | Aprobar; tambien habilita anular la solicitud de otra persona |
| `leaves.holiday.manage` | Registrar, cargar y eliminar festivos |
| `leaves.event.read` | Ver novedades del colaborador |
| `leaves.event.create` | Registrar una novedad |
| `leaves.event.update` | Editar una novedad |
| `leaves.event.delete` | Eliminar una novedad |
| `leaves.disciplinary.read` | Ver procesos disciplinarios; cada lectura queda trazada |
| `leaves.disciplinary.create` | Abrir un proceso disciplinario |
| `leaves.disciplinary.update` | Agregar etapas al proceso |
| `leaves.export.execute` | Exportar a nomina externa y ver el historial de exportaciones |

## Endpoints

Prefijo `/leaves`.

### Tipos, politicas y saldos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/leaves/types` | Tipos de ausencia configurados |
| POST | `/leaves/types` | Crea un tipo |
| PATCH | `/leaves/types/:id` | Actualiza un tipo |
| DELETE | `/leaves/types/:id` | Borrado logico de un tipo |
| GET | `/leaves/policies` | Politicas de vacaciones |
| POST | `/leaves/policies` | Crea una politica (solo dias) |
| GET | `/leaves/balances` | Saldos de todo el alcance del usuario, hasta 500 colaboradores |
| GET | `/leaves/balances/:employeeId` | Saldo de un colaborador, recalculado al consultar |
| POST | `/leaves/balances/adjust` | Ajusta el saldo con motivo |

### Solicitudes y calendario

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/leaves/requests` | Solicitudes con filtros de estado, tipo, rango y `mine=true` |
| GET | `/leaves/requests/:id` | Detalle de una solicitud |
| POST | `/leaves/requests` | Crea la solicitud y dispara el flujo de aprobacion |
| POST | `/leaves/requests/:id/cancel` | Anula la solicitud |
| GET | `/leaves/calendar` | Ausencias y festivos de un rango, filtrable por area y sede |
| GET | `/leaves/holidays` | Festivos registrados |
| POST | `/leaves/holidays` | Registra un festivo |
| POST | `/leaves/holidays/load-colombia` | Carga los festivos de Colombia de los anos indicados |
| DELETE | `/leaves/holidays/:id` | Elimina un festivo |

### Novedades, disciplinarios y exportacion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/leaves/events` | Novedades del colaborador |
| POST | `/leaves/events` | Registra una novedad |
| DELETE | `/leaves/events/:id` | Elimina logicamente una novedad |
| GET | `/leaves/disciplinary` | Procesos disciplinarios, descifrados y con acceso registrado |
| POST | `/leaves/disciplinary` | Abre un proceso, con contenido cifrado |
| POST | `/leaves/disciplinary/:id/steps` | Agrega una etapa (citacion, descargos, decision) |
| POST | `/leaves/payroll-export` | Genera la exportacion en CSV o JSON |
| GET | `/leaves/payroll-export` | Historial de exportaciones |

## Reglas de negocio

Al crear una solicitud las validaciones corren en este orden, y la primera que
falla corta:

1. **Alcance.** Si la solicitud no es para uno mismo, el colaborador debe estar dentro del alcance de `leaves.request.create`; si no, `OUT_OF_SCOPE`.
2. **Tipo activo.** El tipo debe existir, estar activo y no borrado; si no, `NOT_FOUND`.
3. **Soporte obligatorio** (`LEAVE_ATTACHMENT_REQUIRED`, 422). Si el tipo lo exige y no se adjunto ningun archivo. Aplica sobre todo a incapacidades.
4. **Anticipacion minima** (`LEAVE_MIN_NOTICE`, 422). Si faltan menos de `min_notice_days` para el inicio. Los dias se cuentan desde hoy hasta la fecha de inicio.
5. **Rango util.** Si al descontar fines de semana y festivos el calculo da cero dias, se rechaza con `VALIDATION_FAILED`.
6. **Maximo por solicitud** (`LEAVE_MAX_DAYS`, 422). Si el tipo tiene `max_days_per_request` y el calculo lo supera.
7. **Solapamiento** (`LEAVE_OVERLAP`, 409). No puede haber otra ausencia del mismo colaborador en estado `pending`, `approved` o `taken` que se cruce con el rango.
8. **Saldo** (`INSUFFICIENT_BALANCE`, 422). Solo si el tipo tiene `affects_balance`. El error devuelve el saldo completo en `details`.
9. **Cobertura** (`LEAVE_COVERAGE`, 422). Si el tipo la exige y no se indico quien cubre.

Otras reglas:

- **Doble red contra el solapamiento.** El servicio valida antes de escribir para dar un mensaje legible, y la base tiene ademas una restriccion `EXCLUDE USING gist` sobre `(employee_id, daterange(start_date, end_date))` limitada a las solicitudes aprobadas. Si dos peticiones concurrentes esquivan la validacion, la base las frena y el filtro de excepciones traduce el error a `LEAVE_OVERLAP`.
- **Calculo de dias.** Se cuentan dias habiles o calendario segun `counts_business_days` del tipo. Con dias habiles se descuentan los festivos del rango. Medio dia al inicio resta 0.5; medio dia al final resta otro 0.5, pero solo si el rango tiene mas de un dia.
- **Aprobacion opcional por tipo.** Si el tipo no requiere aprobacion, la solicitud nace `approved` con la decision ya sellada. Si la requiere, nace `pending` y se abre una instancia de flujo. Si el motor resuelve de inmediato, la decision se aplica en el acto.
- **La decision se aplica escuchando al motor de flujos.** El manejador de `workflow.resolved` no se registra como asincrono a proposito: si lo fuera, el endpoint de aprobacion responderia antes de que la solicitud cambiara de estado, el aprobador refrescaria la bandeja, la veria aun pendiente y aprobaria dos veces.
- **Aprobar sincroniza asistencia.** Cada dia del rango se marca como `leave` en `attendance_days`. Anular devuelve esos dias a `pending` y limpia la referencia.
- **Saldo siempre recalculado.** No se guarda un saldo que se va sumando: cada consulta lo vuelve a calcular. `accruedDays` se prorratea sobre los dias trabajados del ano (`dias trabajados / 365 * dias por ano`), limitado por la fecha de ingreso, la de retiro y la fecha de hoy. El disponible es `accrued + adjusted + carryOver - taken - pending`. Las solicitudes pendientes ya descuentan, para que nadie pida dos veces los mismos dias.
- **Dias por ano configurables.** Se toman de la politica marcada como predeterminada; si no hay ninguna, se usan los 15 dias habiles de la norma colombiana. Marcar una politica como predeterminada desmarca la anterior.
- **Anular.** Solo el titular puede anular su solicitud; cualquier otra persona necesita `leaves.request.approve`. Una ausencia ya disfrutada (`taken`) no se anula. Anular cancela tambien la instancia de flujo.
- **Festivos de Colombia sin duplicar.** La carga por anos salta los que ya existen para esa fecha sin sede especifica. La tabla tiene `@@unique([companyId, date, locationId])`, lo que permite festivos locales por sede.
- **Proceso disciplinario.** El numero se genera como `DIS-00001` a partir del conteo de la empresa. El asunto, la descripcion, la decision y el contenido de cada etapa se guardan cifrados. La lista lleva `@SensitiveAccess`, asi que cada consulta deja rastro.
- **Exportacion a nomina.** Arma filas de tres origenes segun se pidan: ausencias aprobadas o disfrutadas, novedades del periodo y dias de asistencia con horas extra o ausencia injustificada. Cada fila lleva el codigo de nomina del tipo, o su `code` si no hay uno. Se guarda el registro de la exportacion con el conteo de filas y se sella `exported_at` en las ausencias incluidas. El CSV usa punto y coma, reemplaza los punto y coma del contenido por comas y va precedido de un BOM para que Excel lo abra como UTF-8.

## Datos

| Tabla | Que guarda |
|---|---|
| `leave_types` | Las reglas de cada tipo: aprobacion, soporte, saldo, dias habiles, maximo, anticipacion, cobertura, si es remunerada y su codigo de nomina |
| `leave_policies` | Dias por ano, modo de causacion, tope de dias arrastrados, umbral de alerta por acumulacion y minimo por solicitud |
| `leave_balances` | Saldo por colaborador, tipo y ano: causado, tomado, pendiente, ajustado y arrastrado |
| `leave_balance_adjustments` | Cada ajuste manual con dias, motivo, ano y quien lo hizo |
| `leave_requests` | Fechas, medios dias, dias calculados, estado, cobertura, instancia de flujo, decision y `exported_at` |
| `holidays` | Festivos por empresa, fecha y sede opcional |
| `employee_events` | Novedades: tipo, titulo, rango, cantidad, unidad y codigo de nomina |
| `disciplinary_cases`, `disciplinary_case_steps` | Procesos disciplinarios y sus etapas |
| `payroll_exports` | Historial de exportaciones: periodo, alcances, formato, filas y estado |

Columnas cifradas en reposo:

- `disciplinary_cases`: `subject`, `description`, `decision`.
- `disciplinary_case_steps`: `content`.

Los saldos se guardan en `Decimal(8,2)` porque los medios dias son legitimos;
nunca hay importes.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/leaves` | Ausencias | Lista de solicitudes con filtros, creacion de solicitud y decision |
| `/leaves/calendario` | Calendario de ausencias | Vista mensual del equipo con los festivos superpuestos |
| `/leaves/saldos` | Saldos de vacaciones | Saldo por colaborador y ano, y ajuste manual |
| `/leaves/novedades` | Novedades del colaborador | Registro y consulta de eventos del periodo |
| `/leaves/exportacion` | Exportacion a nomina externa | Genera el archivo por periodo y alcances, y muestra el historial |

Los procesos disciplinarios no tienen pantalla propia: se consultan por API con
el permiso correspondiente.

## Limites

- No liquida nomina. No calcula el valor de un dia de vacaciones, ni una incapacidad, ni una hora extra. La exportacion entrega dias, cantidades y codigos; el calculo lo hace el sistema de nomina.
- La interfaz con nomina es solo de salida: nada entra desde nomina hacia la plataforma.
- No reemplaza a la EPS ni a la ARL: registra la incapacidad y su soporte, no la tramita ni la transcribe.
- No calcula intereses, compensacion en dinero de vacaciones ni provisiones.
- Las horas extra de la exportacion son informativas y salen de las marcaciones; no se aprueban ni se valorizan aqui.
- No decide quien aprueba: eso lo define el flujo configurado en ajustes.
