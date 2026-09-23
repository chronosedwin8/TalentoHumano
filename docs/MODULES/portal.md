# Portal del colaborador

Es la cara de la plataforma para quien no administra nada: una pantalla de
inicio que reune lo que la persona tiene pendiente, sus datos, sus documentos y
sus solicitudes. Para los jefes agrega la vista de su equipo. Todo lo que
devuelve es sobre uno mismo o sobre los reportes directos.

## Que hace

- Arma una pantalla de inicio con la marcacion del dia, el saldo de vacaciones, los pendientes de cada modulo, las ultimas solicitudes, las publicaciones recientes y los reconocimientos recibidos.
- Cuenta pendientes de ingreso, formacion, evaluaciones, encuestas, politicas por leer y aprobaciones a cargo.
- Muestra la ficha propia con el mismo detalle de la ficha 360.
- Permite actualizar datos propios: unos se aplican de inmediato y otros generan una solicitud que Talento Humano decide.
- Lista los documentos del legajo propio que la empresa marco como visibles para el colaborador.
- Lista los activos entregados y aun no devueltos.
- Lista los certificados de formacion obtenidos.
- Reune en un solo lugar las solicitudes de ausencia, los tickets abiertos y las solicitudes de cambio de datos.
- Para un jefe, muestra sus reportes directos con sus ausencias vigentes y sus procesos de ingreso o salida en curso.

## Permisos

Ningun endpoint del portal exige un permiso del catalogo. Lo que exige es el
modulo `dashboard` activo y una sesion valida; el alcance de los datos no viene
de un permiso sino de la identidad: el controlador filtra siempre por el
`employeeId` del contexto, o por `managerId` en el caso del equipo.

La unica puerta de permisos que se atraviesa es indirecta: la ficha propia se
resuelve con la misma funcion que usa el modulo de personal, asi que el bloque
de datos sensibles llega enmascarado salvo que el usuario tenga
`people.sensitive.read`. Un colaborador comun no lo tiene, de modo que no ve
descifrados ni su cuenta bancaria ni su salario desde esta pantalla.

## Endpoints

Prefijo `/portal`.

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/portal/home` | Resumen del inicio: marcacion del dia, saldo, pendientes, solicitudes, muro y reconocimientos |
| GET | `/portal/me` | Ficha del colaborador autenticado |
| PATCH | `/portal/me` | Actualiza datos propios; los sensibles pasan por aprobacion |
| GET | `/portal/my-documents` | Documentos del legajo propio marcados como visibles |
| GET | `/portal/my-assets` | Activos asignados y no devueltos |
| GET | `/portal/my-certificates` | Certificados de formacion |
| GET | `/portal/my-requests` | Ausencias, tickets y solicitudes de cambio de datos |
| GET | `/portal/my-team` | Reportes directos con ausencias vigentes y procesos en curso |

## Reglas de negocio

- **Una sola peticion para el inicio.** El resumen ejecuta en paralelo diez consultas y devuelve un unico objeto. La alternativa seria que la pantalla de inicio llamara a ocho modulos distintos; aqui se paga un endpoint agregado a cambio de una sola ida al servidor.
- **Usuario sin colaborador asociado.** Cada consulta comprueba que el contexto tenga `employeeId`. Si no lo tiene, el endpoint devuelve vacio o cero en vez de fallar: un usuario administrador que no es colaborador puede entrar al portal sin ver un error.
- **Pendientes con criterio por modulo.** Las tareas cuentan las de ingreso pendientes, en curso o vencidas. Los cursos cuentan las inscripciones asignadas o en curso. Las evaluaciones cuentan solo las asignaciones donde el usuario es el evaluador y cuyo ciclo esta en autoevaluacion o evaluacion: una evaluacion de un ciclo en calibracion ya no es algo que la persona pueda responder. Las encuestas cuentan las invitaciones sin responder de encuestas abiertas. Las politicas cuentan los acuses sin firmar.
- **Autoservicio dividido.** Telefono, movil, correo personal, direccion, ciudad y las preferencias de visibilidad se aplican al instante. Nombres, tipo y numero de documento, fecha de nacimiento, genero y nacionalidad generan una solicitud de cambio pendiente. La respuesta dice que se aplico, que quedo pendiente y con que identificador de solicitud, para que la pantalla pueda explicarlo.
- **Legajo filtrado por tipo de documento.** Solo se devuelven los documentos cuyo tipo tiene `visible_to_employee`. Es la empresa la que decide que parte del legajo ve la persona: un contrato si, una nota interna no.
- **Tickets por usuario, no por colaborador.** Las solicitudes de ausencia y los cambios de datos se buscan por `employeeId`, pero los tickets se buscan por `requesterUserId`, porque un ticket lo abre un usuario y puede no existir un colaborador detras.
- **Equipo por reporte directo.** `my-team` usa solo el jefe directo, no el arbol completo. Trae las ausencias pendientes o aprobadas que aun no terminan y los procesos de ingreso o salida que siguen abiertos.
- **Reconocimientos y muro sin filtro de audiencia adicional.** El inicio muestra las cinco publicaciones publicadas mas recientes, con las fijadas primero, y los tres ultimos reconocimientos recibidos.

## Datos

El portal no tiene tablas propias. Lee de las de otros modulos, siempre
acotadas al colaborador del contexto:

| Tabla | Para que la lee |
|---|---|
| `attendance_days` | La marcacion y el estado del dia de hoy |
| `leave_balances` a traves del calculo de saldo | Dias de vacaciones disponibles |
| `leave_requests` | Solicitudes propias, vigentes y recientes |
| `onboarding_tasks`, `onboarding_processes` | Pendientes propios y procesos del equipo |
| `enrollments`, `certificates` | Formacion pendiente y certificados obtenidos |
| `review_assignments` | Evaluaciones que el usuario debe responder |
| `survey_invitations` | Encuestas sin responder |
| `policy_acknowledgements` | Politicas pendientes de acuse |
| `employees`, `employee_personal_data` | Ficha propia y equipo a cargo |
| `documents`, `document_types` | Legajo visible |
| `asset_assignments`, `assets` | Activos entregados |
| `tickets` | Tickets abiertos por el usuario |
| `employee_change_requests` | Solicitudes de cambio de datos propias |
| `posts`, `recognitions` | Muro y reconocimientos del inicio |

El cifrado y el enmascaramiento los aplica el modulo dueno de cada tabla; el
portal no descifra nada por su cuenta.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/portal` | Inicio del portal | Pendientes, saldo, marcacion del dia, muro y reconocimientos |
| `/portal/perfil` | Mi perfil | Consultar y actualizar los datos propios |
| `/portal/solicitudes` | Mis solicitudes | Ausencias, tickets y cambios de datos solicitados |
| `/portal/equipo` | Mi equipo | Colaboradores a cargo, ausencias vigentes y procesos en curso |
| `/portal/tareas` | Mis tareas | Tareas de ingreso asignadas al usuario |
| `/portal/documentos` | Mis documentos | Documentos generados y legajo visible |
| `/portal/tickets/:id` | Detalle del ticket | Conversacion del ticket propio |

## Limites

- No muestra informacion salarial descifrada: el bloque sensible llega enmascarado para quien no tiene el permiso, y un colaborador comun no lo tiene.
- No liquida nomina ni muestra desprendibles de pago; la plataforma no calcula valores.
- No permite editar libremente los datos propios: los que identifican a la persona siempre pasan por aprobacion.
- No da acceso al legajo completo, solo a los tipos de documento que la empresa marco como visibles.
- La vista de equipo llega hasta los reportes directos; no baja por toda la jerarquia.
- No crea solicitudes por si mismo: se consultan aqui, pero se crean en el modulo correspondiente.
