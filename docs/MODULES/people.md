# Personal

Es el registro maestro de quien trabaja en la empresa. Todo lo demas cuelga de
aqui: una ausencia, una evaluacion o un ticket apuntan a un `employee`. Lo usa
Talento Humano para mantener la ficha y el legajo al dia, y los jefes para ver
a su gente dentro del alcance que su rol les da.

## Que hace

- Mantiene la ficha 360 del colaborador: datos basicos, cargo, area, sede, centro de costo y jefe.
- Separa los datos personales sensibles en un bloque aparte, cifrado y con permiso propio.
- Registra el historial de vinculos (contratos) y marca cual es el vigente.
- Registra movimientos de personal (promocion, traslado, cambio de jefe) que pasan por el flujo de aprobacion antes de aplicarse.
- Lleva el legajo digital por tipo de documento, con versiones y fecha de vencimiento.
- Solicita documentos faltantes al colaborador y cierra la solicitud sola cuando el documento llega.
- Avisa que contratos y que documentos vencen en los proximos dias.
- Administra el inventario de activos y su asignacion y devolucion.
- Recibe cambios de datos que el colaborador hace desde el portal y los enruta: unos se aplican solos, otros esperan aprobacion.
- Importa colaboradores desde Excel validando fila por fila, con modo de prueba.
- Registra el retiro: inactiva al colaborador, cierra el contrato vigente y revoca sus sesiones.
- Publica organigrama y directorio interno (ambos viven en el controlador de organizacion).
- Emite eventos de dominio (`employee.created`, `employee.updated`, `employee.terminated`, `employee.moved`) que otros modulos escuchan.

## Permisos

| Permiso | Para que |
|---|---|
| `people.employee.read` | Ver la lista y la ficha de colaboradores, limitada por el alcance del grant |
| `people.employee.create` | Dar de alta un colaborador |
| `people.employee.update` | Editar la ficha, los datos personales, el retiro y los subrecursos del perfil |
| `people.employee.delete` | Eliminar logicamente un colaborador |
| `people.employee.export` | Exportar la lista de colaboradores |
| `people.employee.import` | Importar colaboradores desde Excel y ver la plantilla |
| `people.sensitive.read` | Descifrar el bloque sensible y el salario; cada lectura queda en `sensitive_access_logs` |
| `people.contract.read` | Ver el historial de vinculos y los contratos por vencer |
| `people.contract.create` | Registrar un contrato |
| `people.contract.update` | Editar un contrato |
| `people.contract.delete` | Eliminar un contrato |
| `people.movement.read` | Ver movimientos de personal |
| `people.movement.create` | Registrar un movimiento |
| `people.movement.update` | Editar un movimiento |
| `people.movement.approve` | Aprobar un movimiento |
| `people.document.read` | Ver el legajo y los documentos por vencer |
| `people.document.create` | Cargar un documento al legajo |
| `people.document.update` | Editar un documento del legajo |
| `people.document.delete` | Eliminar un documento del legajo |
| `people.document.request` | Solicitar documentos faltantes a un colaborador |
| `people.documenttype.manage` | Administrar los tipos de documento del legajo |
| `people.asset.read` | Ver el inventario de activos |
| `people.asset.create` | Registrar un activo |
| `people.asset.update` | Asignar y registrar la devolucion de un activo |
| `people.asset.delete` | Eliminar un activo |
| `people.orgchart.read` | Ver el organigrama |
| `people.directory.read` | Ver el directorio interno |
| `people.changerequest.read` | Ver las solicitudes de cambio de datos |
| `people.changerequest.approve` | Aprobar o rechazar una solicitud de cambio de datos |

## Endpoints

Prefijo `/people`, salvo donde se indique.

### Colaboradores

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/people/employees` | Lista segun el alcance del permiso, con busqueda y filtros |
| GET | `/people/employees/headcount` | Resumen por area, sede y estado |
| GET | `/people/employees/:id` | Ficha 360; enmascara el bloque sensible sin permiso |
| POST | `/people/employees` | Crea el colaborador y, si se pide, su usuario |
| PATCH | `/people/employees/:id` | Actualiza los datos basicos |
| DELETE | `/people/employees/:id` | Borrado logico |
| PATCH | `/people/employees/:id/personal-data` | Guarda el bloque sensible cifrado |
| POST | `/people/employees/:id/terminate` | Registra el retiro |
| POST | `/people/employees/:id/education` | Agrega formacion academica |
| POST | `/people/employees/:id/emergency-contacts` | Agrega contacto de emergencia |
| POST | `/people/employees/:id/skills` | Reemplaza las habilidades del colaborador |
| POST | `/people/employees/import` | Importa desde Excel, fila por fila |
| GET | `/people/employees/import/template` | Columnas esperadas por la plantilla |

### Vinculacion y movimientos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/people/employees/:id/contracts` | Historial de vinculos |
| POST | `/people/contracts` | Registra un contrato (salario informativo cifrado) |
| GET | `/people/contracts/expiring` | Contratos por vencer (`days`, 60 por defecto) |
| GET | `/people/movements` | Movimientos de personal |
| POST | `/people/movements` | Registra el movimiento y abre el flujo de aprobacion |

### Legajo y activos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/people/document-types` | Tipos de documento configurados |
| POST | `/people/document-types` | Crea un tipo de documento |
| GET | `/people/employees/:id/documents` | Legajo digital, con el archivo resuelto |
| POST | `/people/documents` | Agrega un documento como nueva version del tipo |
| DELETE | `/people/documents/:id` | Elimina logicamente un documento |
| GET | `/people/documents/expiring` | Documentos vencidos o por vencer (`days`, 30 por defecto) |
| POST | `/people/document-requests` | Solicita documentos faltantes |
| GET | `/people/assets` | Inventario de activos |
| POST | `/people/assets` | Registra un activo |
| POST | `/people/assets/assign` | Asigna un activo a un colaborador |
| POST | `/people/assets/assignments/:id/return` | Registra la devolucion |

### Cambios de datos, organigrama y directorio

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/people/change-requests` | Solicitudes de cambio, pendientes por defecto |
| POST | `/people/change-requests/:id/decide` | Aprueba o rechaza y, si aprueba, aplica el cambio |
| GET | `/organization/orgchart` | Jerarquia de reporte directo |
| GET | `/organization/directory` | Directorio interno |

## Reglas de negocio

- **Alta unica por documento o correo.** Si ya existe un colaborador activo con el mismo `documentNumber` o el mismo `email`, la creacion falla con `CONFLICT` y devuelve en `details` el registro que choca. La base refuerza lo mismo con `@@unique([companyId, documentNumber])`.
- **Codigo de empleado automatico.** Si no se envia, se genera `EMP-00001` a partir del conteo de la empresa y se incrementa hasta encontrar uno libre; el conteo solo no basta porque un codigo escrito a mano puede haber ocupado el siguiente.
- **Usuario opcional en el alta.** Salvo que se pida lo contrario, se crea el usuario con el rol `employee` de la empresa y se envia invitacion. Si ese rol no existe, no se crea usuario y el alta sigue.
- **Dato sensible con doble puerta.** Descifrar el bloque exige `people.sensitive.read`; sin ese permiso los campos llegan enmascarados. Cuando si se tiene, la lectura queda registrada en `sensitive_access_logs` antes de devolver la ficha.
- **Alcance de datos.** El alcance del grant (`own`, `team`, `area`, `company`) se traduce a un conjunto concreto de ids: `team` recorre la jerarquia de jefes de forma recursiva, `area` recorre el arbol de areas. Pedir la ficha de alguien fuera del conjunto devuelve `OUT_OF_SCOPE`.
- **Movimiento aprobado antes de aplicarse.** Al crearlo se guardan los valores previos y los nuevos, queda en `pending_approval` y se abre una instancia de flujo. Solo cuando el flujo resuelve aprobado se copian los valores nuevos a la ficha y el movimiento pasa a `applied`. Volver a aplicar un movimiento ya aplicado no hace nada.
- **Legajo versionado.** Cargar un documento del mismo tipo no reemplaza el anterior: crea la version siguiente. Si la fecha de vencimiento ya paso, nace con estado `expired`.
- **Solicitud de documento que se cierra sola.** Al cargar un documento se marcan como `completed` las solicitudes pendientes de ese colaborador y ese tipo, para no pedir dos veces lo mismo.
- **Autoservicio dividido en dos.** Telefono, movil, correo personal, direccion, ciudad y las preferencias de visibilidad se aplican de inmediato. Nombres, tipo y numero de documento, fecha de nacimiento, genero y nacionalidad crean una solicitud de cambio pendiente que Talento Humano decide. Cualquier otro campo se ignora.
- **Al aprobar un cambio de nombre se recalcula `full_name`.** La ficha guarda el nombre completo denormalizado para buscar rapido, asi que se reconstruye despues de aplicar el cambio.
- **Retiro con efectos en cadena.** Pone el estado en `inactive`, fija `terminated_at` y `exit_reason`, cierra el contrato vigente con esa misma fecha y, si el colaborador tiene usuario, lo inactiva y revoca sus sesiones abiertas.
- **Importacion con simulacro.** Cada fila se valida contra el mismo esquema del alta individual y el resultado dice, fila por fila, si quedo `ok` o cual fue el error. Con `dryRun` no escribe nada. La importacion nunca crea usuarios.
- **Devolver un activo** cierra la asignacion y deja el activo en `available`.

## Datos

| Tabla | Que guarda |
|---|---|
| `employees` | Ficha basica, jerarquia (`manager_id`), estado, ingreso y retiro, consentimiento de datos |
| `employee_personal_data` | Bloque sensible, uno por colaborador |
| `emergency_contacts`, `dependents` | Contactos de emergencia y personas a cargo |
| `education`, `work_experience`, `certifications`, `employee_languages` | Hoja de vida |
| `skills`, `employee_skills` | Catalogo de habilidades y nivel por persona, de 1 a 5 |
| `employment_contracts` | Historial de vinculos, con `is_current` y fecha de fin |
| `employee_movements` | Valores previos y nuevos de cada movimiento, mas su estado |
| `document_types` | Tipos del legajo, si son obligatorios y si vencen |
| `documents` | Documentos del legajo con `version`, `expires_at` y estado |
| `document_requests` | Documentos pedidos al colaborador, con vencimiento y recordatorios enviados |
| `assets`, `asset_assignments` | Inventario y entregas, con condicion de salida y de entrada |
| `employee_change_requests` | `changes` y `previous` en JSON, mas la decision y el comentario |
| `custom_field_definitions`, `custom_field_values` | Campos adicionales por empresa sobre la entidad `employee` |

Columnas cifradas en reposo (AES-256-GCM, texto con prefijo `enc:v1:`):

- `employee_personal_data`: `bank_name`, `bank_account_type`, `bank_account_number`, `base_salary`, `disability`, `medical_notes`.
- `employment_contracts.base_salary`.

El esquema marca el salario como informativo y no entra en ningun calculo: se
guarda para verlo en la ficha y para exportarlo, no para liquidar.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/people` | Colaboradores | Lista con busqueda y filtros, alta en dialogo y accesos a organigrama y directorio |
| `/people/employees/:id` | Ficha del colaborador | Pestanas Datos personales, Vinculacion, Legajo, Formacion, Activos y Equipo; tambien el registro del retiro con su motivo |
| `/people/organigrama` | Organigrama | Jerarquia de reporte directo |
| `/people/directorio` | Directorio | Busqueda de companeros por nombre y area, respetando `directory_visible` |
| `/people/activos` | Activos | Inventario de equipos y dotacion entregada |

## Limites

- No liquida nomina ni calcula prestaciones, retenciones ni aportes. El salario se guarda cifrado como dato informativo.
- No lleva contabilidad ni valoriza los activos: el inventario es de control fisico, no un libro de activos fijos.
- No firma contratos; guarda el archivo y los datos del vinculo. La firma vive en el modulo de documentos.
- No decide movimientos por su cuenta: la decision la toma el flujo de aprobacion configurado en ajustes.
- No genera certificados laborales; eso es del modulo de documentos.
- La importacion no crea usuarios ni envia invitaciones.
