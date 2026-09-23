# Configuracion

Es el nucleo administrativo: la empresa y su marca, la estructura organizativa,
los usuarios y sus roles, que modulos se ven, que catalogos y campos existen,
como se aprueban las solicitudes, que se notifica, con que se integra y que
queda auditado. Lo usa quien administra la plataforma; el resto de modulos vive
de lo que aqui se define.

## Que hace

- Guarda los datos de la empresa y su marca: logo, colores, pais, zona horaria, idioma y politica de privacidad.
- Administra sedes, areas en arbol, cargos con sus competencias y centros de costo.
- Administra usuarios: alta con invitacion, roles, activacion, restablecimiento de contrasena y cambio forzado.
- Define roles del sistema y personalizados, con permisos y alcance de datos por permiso.
- Resuelve los permisos efectivos combinando roles, sobrescrituras por usuario y delegaciones vigentes.
- Controla la visibilidad de los modulos en tres niveles: empresa, rol y usuario.
- Administra catalogos configurables y campos personalizados por entidad.
- Define flujos de aprobacion por tipo de entidad, con pasos condicionales y tipos de aprobador.
- Ofrece una bandeja unica de aprobaciones, transversal a todos los modulos.
- Publica formularios dinamicos versionados y recoge sus respuestas.
- Emite webhooks firmados por evento de dominio y administra API keys con lista de permisos.
- Centraliza las notificaciones del usuario y sus preferencias por evento y canal.
- Administra la subida y descarga de archivos con URL prefirmada.
- Registra la bitacora de auditoria y el registro aparte de accesos a datos sensibles.

## Permisos

| Permiso | Para que |
|---|---|
| `settings.company.read`, `settings.company.update` | Ver y actualizar los datos y la marca de la empresa |
| `settings.location.read`, `settings.location.create`, `settings.location.update`, `settings.location.delete` | Sedes |
| `settings.department.read`, `settings.department.create`, `settings.department.update`, `settings.department.delete` | Areas |
| `settings.position.read`, `settings.position.create`, `settings.position.update`, `settings.position.delete` | Cargos y sus competencias requeridas |
| `settings.costcenter.read`, `settings.costcenter.create`, `settings.costcenter.update`, `settings.costcenter.delete` | Centros de costo |
| `settings.user.read`, `settings.user.create`, `settings.user.update`, `settings.user.delete` | Usuarios de la empresa y sus roles |
| `settings.user.impersonate` | Suplantar a un usuario |
| `settings.role.read`, `settings.role.create`, `settings.role.update`, `settings.role.delete` | Roles y el catalogo de permisos |
| `settings.module.manage` | Matriz de modulos por empresa, rol y usuario |
| `settings.catalog.manage` | Catalogos configurables |
| `settings.customfield.manage` | Campos personalizados por entidad |
| `settings.workflow.manage` | Flujos de aprobacion |
| `settings.notification.manage` | Plantillas de notificacion |
| `settings.form.manage` | Formularios dinamicos y sus respuestas |
| `settings.integration.manage` | API keys, webhooks y sus entregas |
| `settings.delegation.manage` | Delegaciones temporales de permisos |
| `settings.audit.read` | Bitacora de auditoria y accesos sensibles |
| `settings.retention.manage` | Retencion y Habeas Data, incluida la anonimizacion de candidatos |
| `workflow.instance.read` | Ver la bandeja de aprobaciones |
| `workflow.instance.approve` | Aprobar o rechazar un paso |
| `workflow.instance.delegate` | Delegar la aprobacion en otro usuario |

## Endpoints

### Empresa, catalogos y modulos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/settings/company` | Datos y marca de la empresa activa |
| PATCH | `/settings/company` | Actualiza la configuracion y el white-label |
| GET | `/settings/catalogs` | Catalogos configurables disponibles |
| GET | `/settings/catalogs/:key` | Elementos de un catalogo |
| POST, PATCH, DELETE | `/settings/catalogs[/:id]` | Crea, actualiza y elimina un elemento de catalogo |
| GET | `/settings/custom-fields` | Campos personalizados por entidad |
| POST, PATCH, DELETE | `/settings/custom-fields[/:id]` | Crea, actualiza y elimina un campo personalizado |
| GET, POST | `/settings/modules` | Consulta y guarda la matriz de modulos |
| GET | `/settings/permissions` | Catalogo de permisos agrupado por modulo |

### Organizacion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/organization/locations` | Sedes |
| POST, PATCH, DELETE | `/organization/locations[/:id]` | Crea, actualiza y elimina logicamente una sede |
| GET | `/organization/departments` | Areas |
| GET | `/organization/departments/tree` | Areas en arbol, con headcount |
| POST, PATCH, DELETE | `/organization/departments[/:id]` | Crea, actualiza y elimina logicamente un area |
| GET | `/organization/positions` | Cargos |
| GET | `/organization/positions/:id` | Cargo con sus competencias |
| POST, PATCH, DELETE | `/organization/positions[/:id]` | Crea, actualiza y elimina logicamente un cargo |
| POST | `/organization/positions/:id/competencies` | Competencias requeridas del cargo |
| GET | `/organization/cost-centers` | Centros de costo |
| POST, PATCH, DELETE | `/organization/cost-centers[/:id]` | Crea, actualiza y elimina logicamente un centro de costo |

### Usuarios, roles y delegaciones

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/users` | Usuarios de la empresa con sus roles |
| POST | `/users` | Crea e invita a un usuario |
| POST | `/users/:userId/roles` | Reasigna los roles |
| PATCH | `/users/:userId/status` | Activa o desactiva |
| POST | `/users/:userId/reset-password` | Genera una contrasena temporal y la envia |
| POST | `/users/:userId/force-password-change` | Obliga a cambiar la contrasena |
| GET | `/users/roles/all` | Roles del sistema y personalizados |
| POST, DELETE | `/users/roles[/:id]` | Crea o actualiza un rol, y elimina uno personalizado |
| GET | `/users/delegations/all` | Delegaciones temporales |
| POST, DELETE | `/users/delegations[/:id]` | Crea y revoca una delegacion |

### Flujos, formularios, integraciones, archivos y auditoria

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/workflows/inbox` | Bandeja unica de aprobaciones |
| GET | `/workflows/inbox/count` | Cantidad de pendientes |
| GET | `/workflows/instances/:id` | Detalle de una solicitud en curso |
| POST | `/workflows/instances/:id/approve` | Aprueba el paso actual |
| POST | `/workflows/instances/:id/reject` | Rechaza la solicitud |
| POST | `/workflows/instances/:id/delegate` | Delega la aprobacion |
| GET | `/workflows/definitions` | Flujos configurados |
| POST | `/workflows/definitions` | Crea o reemplaza un flujo |
| POST | `/workflows/definitions/:id/archive` | Desactiva un flujo |
| GET | `/forms` | Formularios dinamicos |
| GET | `/forms/:key` | Version publicada de un formulario |
| POST | `/forms` | Crea o publica una nueva version |
| POST | `/forms/:key/submissions` | Guarda una respuesta |
| GET | `/forms/:key/submissions` | Respuestas recibidas |
| GET | `/integrations/events` | Eventos de dominio disponibles |
| GET, POST, DELETE | `/integrations/api-keys[/:id]` | API keys; la clave se muestra una sola vez |
| GET, POST, DELETE | `/integrations/webhooks[/:id]` | Webhooks firmados con HMAC |
| GET | `/integrations/webhooks/:id/deliveries` | Historial de entregas |
| GET | `/notifications`, `/notifications/unread-count` | Centro de notificaciones y pendientes |
| POST | `/notifications/read` | Marca como leidas |
| GET, POST | `/notifications/preferences` | Preferencias por evento y canal |
| POST | `/files/presign`, `/files/:id/confirm` | Pide la URL prefirmada y confirma la subida |
| GET, DELETE | `/files/:id` | Metadatos con URL temporal, y borrado logico |
| GET | `/audit/logs` | Bitacora con filtros |
| GET | `/audit/sensitive-access` | Accesos a datos sensibles |
| GET | `/audit/entity-types` | Tipos de entidad presentes en la auditoria |

## Reglas de negocio

- **Permisos efectivos en cuatro capas.** Se parte de los permisos de los roles del usuario, se aplican las sobrescrituras por usuario (que pueden otorgar o revocar, y pueden vencer), y se suman las delegaciones vigentes recibidas de otras personas. Cuando el mismo permiso llega por varios caminos, gana el alcance mas amplio: `company` sobre `area`, `area` sobre `team`, `team` sobre `own`. Los permisos delegados entran con alcance `company`.
- **Resultado en cache por un minuto.** El calculo es costoso y se repite en cada peticion, asi que se guarda por usuario de empresa durante sesenta segundos. Toda mutacion de roles, sobrescrituras, delegaciones o visibilidad de modulos invalida esa entrada, de modo que un cambio de permisos se siente enseguida sin tener que recalcular siempre.
- **Visibilidad de modulos en tres niveles.** El rol muestra, el usuario sobrescribe, y la empresa decide al final: un modulo apagado a nivel de empresa nunca se ve, aunque el rol lo muestre. El superadministrador ve todos los modulos que la empresa tenga registrados.
- **El rol de superadministrador solo lo asigna un superadministrador.** Cualquier otro intento devuelve `FORBIDDEN`.
- **Nadie se desactiva a si mismo.** Intentar poner el propio usuario en inactivo devuelve `VALIDATION_FAILED`. Desactivar a otro revoca todas sus sesiones abiertas.
- **Alta de usuario reutilizando la identidad.** Si el correo ya existe como usuario global, no se crea otro: se agrega la pertenencia a esta empresa. La contrasena temporal solo se devuelve cuando el usuario es nuevo; para uno existente no se toca su contrasena. Forzar el cambio de contrasena revoca las sesiones abiertas, para que el cambio ocurra de verdad en el proximo ingreso.
- **Un flujo sin definicion aprueba solo.** Si la empresa no tiene un flujo activo para ese tipo de entidad, o ninguno de sus pasos aplica, la solicitud se resuelve como aprobada sin crear instancia. Es lo que permite que cada modulo funcione desde el primer dia y gane aprobaciones cuando se configure el flujo, no antes.
- **Pasos condicionales.** Un paso sin condicion siempre aplica, asi que un flujo de pasos simples se comporta como una cadena recta. Con condicion se compara un campo del contexto con los operadores `gt`, `gte`, `lt`, `lte`, `eq`, `neq` e `in`: sirve para, por ejemplo, agregar un segundo aprobador solo cuando la ausencia supera cierto numero de dias.
- **Tipos de aprobador.** Usuario fijo, el propio solicitante, jefe directo, jefe del jefe, jefe del area o el primer titular de un rol; `hr` apunta al rol `hr_admin`.
- **Paso sin aprobador se aprueba solo y deja rastro.** Si no se puede resolver a nadie para el paso actual, se marca aprobado con el comentario de que fue automatico por falta de aprobador, y el flujo avanza. Es preferible a que una solicitud quede atascada para siempre.
- **Decisiones** (`WORKFLOW_ALREADY_RESOLVED`, 409 si la solicitud ya se resolvio; `WORKFLOW_STEP_NOT_ALLOWED`, 403 si quien decide no es el aprobador del paso, su delegado, superadministrador o administrador de la empresa). Rechazar corta el flujo completo; aprobar avanza al siguiente paso pendiente y, si no queda ninguno, resuelve la instancia y emite `workflow.resolved`, que es lo que cada modulo escucha para aplicar la decision.
- **Delegar sustituye al aprobador del paso actual** y queda registrado como una accion del flujo.
- **API key: se ve una vez.** La clave se genera con prefijo `tal_`, se guarda solo su hash y su prefijo, y el valor en claro se devuelve unicamente en la creacion. Al verificarla se actualiza `last_used_at`.
- **Webhooks firmados y fuera del camino critico.** El despachador escucha todos los eventos de dominio salvo los de flujo, y lo hace de forma explicitamente asincrona: el emisor no espera, de modo que un tercero lento o caido nunca demora la respuesta de la operacion que disparo el evento. Cada entrega se guarda en su propia tabla con intentos, codigo de respuesta y error, y el cuerpo va firmado con HMAC SHA-256 en la cabecera `X-Talento-Signature`, con tiempo de espera de diez segundos.
- **La auditoria nunca rompe la operacion.** Si el registro falla, se escribe en el log del servidor y la operacion de negocio sigue.
- **Secretos fuera del diff.** El calculo de diferencias omite contrasenas, secretos de doble factor, y los hashes de token, de clave de acceso y de API key. El diff es superficial, con `{ campo: { from, to } }`, y normaliza fechas y decimales para no marcar cambios falsos.
- **Accesos sensibles en tabla aparte.** Leer datos marcados como sensibles se registra en `sensitive_access_logs` con el permiso usado, la entidad y la IP, separado de la bitacora general.
- **Archivos** (`FILE_TOO_LARGE`, 413; `FILE_TYPE_NOT_ALLOWED`, 415). El tamano maximo sale de la configuracion del entorno, con 50 MB por defecto, y el tipo debe estar en la lista permitida compartida.

## Datos

| Tabla | Que guarda |
|---|---|
| `companies` | Datos, marca, pais, zona horaria, idioma y politica de privacidad |
| `users`, `company_users` | Identidad global y pertenencia a cada empresa |
| `roles`, `user_roles`, `permissions`, `role_permissions` | Roles, su asignacion y los permisos que otorgan con su alcance |
| `user_permission_overrides` | Permisos otorgados o revocados por usuario, con vencimiento |
| `delegations` | Delegacion temporal de permisos entre usuarios, con vigencia |
| `app_modules`, `company_modules`, `role_modules`, `user_modules` | Catalogo de modulos y su visibilidad en los tres niveles |
| `sessions`, `password_reset_tokens` | Sesiones abiertas y enlaces de recuperacion |
| `locations`, `departments`, `positions`, `cost_centers` | Estructura organizativa |
| `catalog_items` | Elementos de los catalogos configurables por empresa |
| `custom_field_definitions`, `custom_field_values` | Campos adicionales y sus valores |
| `workflow_definitions`, `workflow_steps` | Flujos por tipo de entidad y sus pasos con condicion y plazo |
| `workflow_instances`, `workflow_step_instances`, `workflow_actions` | Solicitudes en curso, sus pasos y el historial de decisiones |
| `dynamic_forms`, `form_versions`, `form_submissions` | Formularios versionados y sus respuestas |
| `notification_templates`, `notifications`, `notification_deliveries`, `notification_preferences` | Plantillas, avisos, entregas por canal y preferencias |
| `stored_files`, `file_links` | Archivos y su vinculo con la entidad que los usa |
| `api_keys`, `webhooks`, `webhook_deliveries` | Integraciones salientes y su historial |
| `audit_logs`, `sensitive_access_logs` | Bitacora general y registro de accesos sensibles |

Columnas cifradas en reposo:

- `positions`: `salary_range_min`, `salary_range_max`; solo se descifran para quien puede ver salarios.
- `users`: `two_factor_secret` y `two_factor_recovery`.

Se guardan como hash, no cifrados: la contrasena, el token de refresco, el
token de recuperacion y la clave de API. El secreto del webhook se guarda en
claro porque hay que usarlo para firmar cada envio.

## Pantallas

`/settings` y `/settings/:tab` muestran una sola pagina con pestanas; cada
pestana aparece solo si el rol tiene su permiso.

| Pestana | Permiso que la habilita | Que permite |
|---|---|---|
| Empresa | `settings.company.read` | Datos de la empresa y marca |
| Organizacion | `settings.department.read` | Sedes, areas, cargos y centros de costo |
| Usuarios | `settings.user.read` | Alta, roles, estado y contrasenas |
| Roles y permisos | `settings.role.read` | Constructor de roles sobre el catalogo de permisos |
| Modulos | `settings.module.manage` | Matriz de visibilidad por empresa, rol y usuario |
| Catalogos | `settings.catalog.manage` | Elementos de los catalogos configurables |
| Campos personalizados | `settings.customfield.manage` | Campos adicionales por entidad |
| Integraciones | `settings.integration.manage` | API keys, webhooks y entregas |
| Auditoria | `settings.audit.read` | Bitacora y accesos a datos sensibles |

Ademas, `/approvals` muestra la bandeja unica de aprobaciones, con todas las
solicitudes que esperan la decision del usuario sin importar de que modulo
vengan.

## Limites

- No liquida nomina ni lleva contabilidad. Los centros de costo son una referencia informativa y los rangos salariales del cargo son dato, no calculo.
- No hay editor visual de flujos con ramas paralelas: los pasos son una secuencia, con condiciones que deciden si cada paso aplica.
- Los webhooks no reintentan solos: cada entrega guarda sus intentos y su error, pero el reenvio no es automatico.
- La suplantacion de usuario existe y queda auditada, pero no elude el alcance de datos de la persona suplantada.
- El cache de permisos vive un minuto: un cambio hecho directamente en la base, sin pasar por la plataforma, puede tardar ese minuto en verse.
- No administra la retencion de forma automatica: el permiso existe y la anonimizacion de candidatos se dispara desde reclutamiento.
