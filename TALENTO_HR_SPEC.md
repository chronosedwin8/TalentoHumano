# TALENTO — Plataforma de Gestión de Recursos Humanos

> Documento de especificación para Claude Code.
> Autor: Edwin Ortiz Herazo · Versión 1.0 · Septiembre 2026
> Idioma del producto: español (i18n preparado para EN/DE).

---

## 0. Cómo usar este documento (instrucciones para Claude Code)

1. Lee este documento completo antes de escribir código.
2. Trabaja por **fases** (sección 12). No avances a la siguiente fase sin que la anterior compile, tenga migraciones aplicadas, seeds y pruebas mínimas pasando.
3. Antes de cada fase, genera un `PLAN.md` con las tareas concretas y confírmalas conmigo. Al terminar cada fase, actualiza `CHANGELOG.md` y `docs/` con lo construido.
4. Si algo del documento es ambiguo, pregunta **antes** de implementar. Si es un detalle menor, decide con criterio senior, documenta la decisión en `docs/DECISIONS.md` (formato ADR) y sigue.
5. Nunca implementes nómina, liquidaciones, contabilidad ni cálculo de salarios. Si un requerimiento parece rozar eso, se limita a **registrar datos y exportarlos**.
6. Todo el código, comentarios y nombres de tablas/campos en **inglés**; toda la interfaz de usuario en **español** (vía archivos de i18n).
7. Cada módulo se entrega con: migración, modelo, servicio, controlador, validaciones (DTOs), permisos registrados, pantallas, pruebas y datos de ejemplo (seed).

---

## 1. Contexto y objetivo

Construir una plataforma web de gestión de recursos humanos (HRIS + ATS + LMS + portal del empleado) orientada a empresas pequeñas y medianas de Latinoamérica (inicialmente Colombia), desplegable en una instancia EC2 con PostgreSQL.

El producto **no gestiona nómina ni contabilidad**. Cubre todo el ciclo de vida del colaborador: atracción, selección, ingreso, desarrollo, desempeño, bienestar, comunicación, servicio y salida.

Referencias de mercado (funcionalidad, no copiar UI): Buk, Factorial, Personio, BambooHR, Lattice, Workable.

### 1.1 Principios de producto

- **Multiempresa (multi-tenant) desde el día 1**: una instalación puede servir a varias empresas aisladas por `company_id`. Todo dato de negocio pertenece a una empresa.
- **Configurable, no programado**: catálogos, flujos de aprobación, plantillas, tipos de novedad, competencias, etc., se administran desde la UI, no desde código.
- **Módulos activables**: cada empresa activa los módulos que usa; cada usuario ve solo los módulos que su rol/asignación permite.
- **Autoservicio**: el colaborador hace por sí mismo todo lo que no requiera aprobación (actualizar datos, solicitar vacaciones, ver documentos, responder encuestas, cursos).
- **Trazabilidad total**: toda acción relevante deja huella en auditoría (quién, qué, cuándo, desde dónde, valor anterior/nuevo).
- **Privacidad por diseño**: datos personales y sensibles (salud, disciplinarios, denuncias) con acceso restringido y registro de acceso.
- **UX moderna, limpia, rápida y responsiva** (móvil primero para el portal del empleado).

### 1.2 Fuera de alcance (explícito)

- Nómina, liquidación de prestaciones, seguridad social, PILA, contabilidad, facturación, pagos.
- Firma electrónica certificada (se deja preparada una interfaz para integrar proveedor externo).
- Biometría física (se integra por API con relojes/lectores; no se desarrolla firmware).

---

## 2. Stack tecnológico y arquitectura

Stack coherente con los otros proyectos del autor (Node.js + PostgreSQL, desarrollado con Claude Code).

### 2.1 Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | TypeScript (strict) | Backend y frontend |
| Backend | Node.js 22 LTS + **NestJS** | Arquitectura modular, DI, guards, interceptors |
| ORM / migraciones | **Prisma** | Un `schema.prisma`; migraciones versionadas |
| Base de datos | **PostgreSQL 16** | Extensiones: `pgcrypto`, `pg_trgm`, `unaccent`, `btree_gist` |
| Cache / colas | **Redis** + **BullMQ** | Colas: emails, notificaciones, reportes, importaciones, recordatorios |
| Frontend | **React 18 + Vite + TypeScript** | SPA |
| UI | **Tailwind CSS + shadcn/ui** (Radix) | Tema claro/oscuro, diseño limpio |
| Estado / datos | TanStack Query + Zustand | |
| Formularios | React Hook Form + Zod | Zod compartido con backend (paquete `shared`) |
| Tablas / gráficas | TanStack Table + Recharts | |
| Editor de contenido | **Tiptap** (ProseMirror) con esquema de bloques propio, DOMPurify, oEmbed, h5p-standalone, ffmpeg (HLS) en worker | Ver 5.7 |
| Auth | JWT (access 15 min + refresh rotativo en cookie httpOnly), 2FA TOTP opcional, SSO Google/Microsoft (OIDC) | |
| Archivos | S3 (o MinIO local en dev) vía URLs prefirmadas | Nunca servir archivos por el backend |
| Email | Nodemailer + SES/SMTP configurable | Plantillas MJML/Handlebars |
| Realtime | WebSockets (Socket.IO) | Notificaciones, chat de soporte |
| Reportes | Generación PDF (Puppeteer) y XLSX (exceljs) en cola | |
| Tests | Vitest (unit), Supertest (e2e API), Playwright (e2e UI críticos) | |
| Infra | Docker Compose (api, web, postgres, redis, minio, nginx) en EC2; Nginx + Let's Encrypt; PM2 opcional | |
| CI | GitHub Actions: lint, typecheck, tests, build, deploy por SSH a EC2 | |
| Observabilidad | Pino (logs JSON), Sentry (errores), healthcheck `/health`, métricas Prometheus básicas | |

### 2.2 Estructura del repositorio (monorepo con pnpm workspaces)

```
talento/
├── apps/
│   ├── api/                 # NestJS
│   │   └── src/
│   │       ├── common/      # guards, decorators, filters, pipes, utils
│   │       ├── core/        # auth, companies, users, roles, permissions, modules, audit, notifications, files, settings, i18n
│   │       ├── modules/     # un directorio por módulo funcional (recruiting, onboarding, people, time, talent, ...)
│   │       └── main.ts
│   └── web/                 # React + Vite
│       └── src/
│           ├── app/         # router, providers, layout
│           ├── features/    # un directorio por módulo (misma nomenclatura que api/modules)
│           ├── components/  # ui compartida
│           ├── lib/         # api client, auth, i18n, utils
│           └── locales/     # es.json, en.json
├── packages/
│   ├── shared/              # tipos, esquemas Zod, constantes, enums, catálogo de permisos
│   └── config/              # eslint, tsconfig, prettier
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   └── scripts/             # deploy.sh, backup.sh, restore.sh
├── docs/                    # ARCHITECTURE.md, DECISIONS.md, API.md, MODULES/*.md
├── PLAN.md
├── CHANGELOG.md
└── README.md
```

### 2.3 Arquitectura de aplicación

- **API REST** versionada bajo `/api/v1`, documentada con OpenAPI (Swagger) autogenerado desde DTOs.
- Cada módulo NestJS: `controller` → `service` → `repository (Prisma)`; DTOs con `class-validator` o Zod; eventos de dominio con `EventEmitter2` para desacoplar (ej. `employee.hired` dispara onboarding, cuenta de usuario, notificaciones).
- **Multi-tenancy** por columna `company_id` en todas las tablas de negocio + middleware que inyecta el tenant desde el JWT; Prisma extension que filtra automáticamente por `company_id`. Un usuario puede pertenecer a varias empresas (tabla `company_users`) y cambiar de empresa activa.
- **Soft delete** (`deleted_at`) en entidades maestras; borrado físico solo por proceso de retención.
- **Auditoría** vía interceptor + tabla `audit_logs` (entidad, id, acción, diff JSON, actor, ip, user-agent).
- **Motor de workflows** genérico (sección 5.16) usado por vacaciones, permisos, novedades, requisiciones, solicitudes, etc.
- **Motor de notificaciones** genérico (in-app, email, WhatsApp/SMS por proveedor conectable), con preferencias por usuario.
- **Motor de formularios** dinámicos (JSON Schema) para encuestas, evaluaciones, checklists, formularios de operaciones.

### 2.4 Convenciones

- Tablas en `snake_case` plural; PK `id uuid default gen_random_uuid()`; `company_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` en todas las tablas de negocio.
- Enumeraciones como `enum` de Prisma cuando son fijas; como tablas de catálogo (`catalog_items` con `catalog_key`) cuando son configurables por empresa.
- Respuestas API: `{ data, meta }`; errores `{ statusCode, code, message, details }`; paginación cursor u offset (`?page&limit&sort&filter`).
- Fechas en UTC en BD; zona horaria por empresa (`companies.timezone`, default `America/Bogota`).
- Money: no aplica (sin nómina). Cuando se registre salario base en la hoja de vida es **dato informativo cifrado**, no se calcula nada.

---

## 3. Seguridad, cumplimiento y privacidad

- **Roles y permisos granulares** (sección 5.1). Permisos con formato `module.resource.action` (ej. `people.employee.read`, `time.leave.approve`). Alcance de datos: `own` (solo yo), `team` (mis reportes directos e indirectos), `area`, `company`.
- **Datos sensibles** (salud, discapacidad, disciplinarios, denuncias, datos bancarios informativos, salario): cifrado en columna (`pgcrypto`) y permiso específico `*.sensitive.read`; cada lectura queda en `sensitive_access_logs`.
- **Habeas Data (Ley 1581 de 2012, Colombia) / RGPD-ready**: consentimiento de tratamiento de datos registrado (candidatos y colaboradores), política de tratamiento publicada, derecho de acceso/rectificación/supresión, retención configurable por tipo de dato (ej. hojas de vida de candidatos no contratados: 12 meses por defecto, luego anonimización automática).
- **Canal de denuncias**: anonimato real (sin IP ni user-agent almacenados para reportes anónimos), cifrado, acceso solo a rol `ethics_officer`.
- Contraseñas con Argon2id; bloqueo por intentos; recuperación por token de un solo uso; 2FA TOTP; sesiones revocables; política de contraseñas configurable por empresa.
- Rate limiting, Helmet, CORS estricto, CSRF en cookies, validación de todo input, subida de archivos con verificación de MIME y antivirus opcional (ClamAV).
- Backups automáticos diarios de PostgreSQL y S3 (script en `infra/scripts/backup.sh`), retención 30 días, prueba de restauración documentada.
- Registro de accesos y exportación de datos por usuario (para atender solicitudes de Habeas Data).

---

## 4. Modelo organizacional (base de todo)

Entidades que todos los módulos referencian:

- `companies`: razón social, NIT, logo, colores (white-label), timezone, país, idioma, configuración (`settings jsonb`), módulos activos.
- `locations` (sedes): dirección, ciudad, país, timezone.
- `departments` (áreas) jerárquicas (`parent_id`).
- `cost_centers` (opcional, solo referencia informativa).
- `positions` (cargos): nombre, descripción, nivel, familia de cargo, competencias requeridas, `reports_to_position_id`, rango salarial informativo (cifrado), estado.
- `employees`: la persona como colaborador (ver 5.4). Relación `manager_id` para jerarquía real (organigrama).
- `employment_contracts`: historial de vínculos (tipo de contrato, fecha inicio/fin, cargo, área, sede, jornada, modalidad presencial/remoto/híbrido). Sin cálculo alguno.
- `organizational_units` snapshot para organigrama versionado (opcional en fase 2).

---

## 5. Módulos funcionales

Cada módulo describe: objetivo, funcionalidades, entidades principales, reglas de negocio, permisos y KPIs que alimentan analítica. Los módulos marcados **[+]** son adiciones recomendadas por el análisis, no estaban en la petición original.

---

### 5.1 Núcleo: usuarios, roles, permisos y módulos

**Objetivo:** control total de quién entra, qué ve y qué puede hacer.

**Funcionalidades**
- Gestión de usuarios (crear, invitar por email, activar/desactivar, forzar cambio de contraseña, ver sesiones, cerrar sesiones remotas).
- Un usuario puede o no estar vinculado a un `employee` (ej. auditor externo, reclutador freelance, proveedor que reporta denuncia).
- Roles del sistema (no editables): `superadmin` (plataforma), `company_admin`, `hr_admin`, `hr_analyst`, `recruiter`, `manager`, `employee`, `ethics_officer`, `support_agent`, `trainer`, `auditor` (solo lectura).
- Roles personalizados por empresa: se crean seleccionando permisos del catálogo.
- Permisos granulares `module.resource.action` con alcance (`own | team | area | company`).
- **Asignación de módulos visibles por usuario y por rol**: matriz módulo × rol, más override por usuario. El menú lateral y las rutas se construyen dinámicamente desde esta matriz.
- Delegación temporal de permisos (ej. manager de vacaciones delega aprobaciones mientras viaja) con fecha de vencimiento.
- Suplantación segura (`impersonate`) solo para `company_admin`, auditada.

**Entidades:** `users`, `company_users`, `roles`, `permissions`, `role_permissions`, `user_permission_overrides`, `modules`, `company_modules`, `role_modules`, `user_modules`, `delegations`, `sessions`, `audit_logs`, `sensitive_access_logs`.

**Reglas:** todo endpoint tiene decorador `@RequirePermission('x.y.z')`; el frontend oculta lo que no se puede, el backend lo bloquea siempre.

---

### 5.2 Reclutamiento y selección (ATS)

**Objetivo:** optimizar el reclutamiento desde la requisición y publicación hasta la contratación, con seguimiento de candidatos por etapas.

**Funcionalidades**
- **Requisición de personal** con flujo de aprobación (área solicita → HR valida → gerencia aprueba). Motivo: nuevo cargo, reemplazo, temporal.
- **Vacantes**: título, cargo, área, sede, modalidad, tipo de contrato, número de posiciones, descripción, requisitos, competencias, rango salarial informativo (público u oculto), fecha límite, reclutador responsable, entrevistadores.
- **Publicación**: portal público de empleos (`/careers/:companySlug`) con página de marca, filtros y postulación con formulario configurable; enlace compartible; exportación a LinkedIn/Computrabajo/Indeed mediante feed XML/JSON estándar (integración directa por API en fase posterior).
- **Pipeline Kanban** configurable por vacante (etapas por defecto: Nuevo → Preselección → Entrevista HR → Prueba técnica → Entrevista jefe → Referencias → Oferta → Contratado / Descartado). Arrastrar y soltar, acciones masivas.
- **Base de candidatos (talent pool)**: ficha del candidato, múltiples postulaciones, etiquetas, búsqueda por texto en CV (extracción de texto de PDF/DOCX y búsqueda `pg_trgm`), fuente de origen (portal, referido, LinkedIn, manual), detección de duplicados por email/documento.
- **Parsing de CV asistido**: al subir el CV se pre-llenan campos (nombre, email, teléfono, experiencia, educación). Implementar con extracción de texto + heurísticas; dejar interfaz para un parser externo/LLM.
- **Programación de entrevistas**: invitaciones por email/calendario (ICS; Google/Microsoft Calendar en fase posterior), tarjetas de evaluación (**scorecards**) por competencia con puntaje y comentarios, evaluación ciega hasta que todos califiquen (opcional).
- **Pruebas**: adjuntar pruebas técnicas/psicotécnicas, registrar resultados, integrar enlaces externos.
- **Verificación de referencias y antecedentes**: checklist con adjuntos y estado.
- **Ofertas**: plantilla de carta de oferta con variables, envío al candidato, aceptación/rechazo con motivo.
- **Contratación**: botón "Contratar" crea el `employee` con los datos del candidato, mueve el CV al legajo y dispara el **onboarding** automáticamente.
- **Programa de referidos**: colaboradores refieren candidatos desde el portal, seguimiento del referido y registro de recompensa (informativo).
- Comunicación con candidatos: plantillas de email por etapa, envío automático al cambiar de etapa (configurable), historial de correos.
- Descarte con motivo obligatorio (catálogo) y opción de mantener en talent pool.
- Cumplimiento: consentimiento de datos al postularse; anonimización automática al vencer retención.

**Entidades:** `job_requisitions`, `job_postings`, `pipeline_stages`, `candidates`, `applications`, `application_stage_history`, `interviews`, `interview_feedback` (scorecards), `assessments`, `reference_checks`, `offers`, `referrals`, `candidate_tags`, `candidate_documents`, `rejection_reasons`.

**KPIs:** tiempo de cobertura (time-to-fill), tiempo de contratación (time-to-hire), candidatos por vacante, tasa de conversión por etapa, fuente más efectiva, costo por contratación (dato manual), tasa de aceptación de ofertas, vacantes abiertas por área, edad de vacantes.

---

### 5.3 Onboarding y Offboarding **[+ offboarding]**

**Objetivo:** integrar a nuevos colaboradores automatizando el ingreso, asignando tareas de cultura, rol y objetivos; y gestionar la salida ordenada.

**Funcionalidades**
- **Plantillas de onboarding** por cargo/área/sede: lista de tareas con responsable (colaborador, jefe, HR, TI, otro), fecha relativa (ej. "día -3", "día 1", "semana 2"), tipo (documento por firmar, formulario, curso, reunión, lectura, entrega de equipo, acceso a sistema), dependencias.
- **Pre-onboarding**: portal para el nuevo ingreso antes del día 1 (sube documentos, completa datos, lee bienvenida, conoce a su equipo), accesible con enlace temporal.
- Asignación automática al contratar; tablero de progreso por persona y global; recordatorios y escalamiento por vencimiento.
- **Buddy/mentor** asignado; reunión de 30/60/90 días con checklist y encuesta de experiencia de ingreso.
- Integración con LMS (cursos obligatorios de inducción), con documentos (firma de políticas) y con objetivos (OKRs iniciales del rol).
- **Offboarding**: plantillas de salida (entrega de activos, revocación de accesos, paz y salvo por área, entrevista de retiro con encuesta, carta de retiro adjunta, motivo de salida catalogado: renuncia, terminación, fin de contrato, mutuo acuerdo, jubilación, fallecimiento). Al completar, el colaborador pasa a estado `inactive` y se desactiva su usuario en fecha efectiva.
- Checklist de activos entregados/devueltos (integra con 5.4 activos).

**Entidades:** `onboarding_templates`, `onboarding_template_tasks`, `onboarding_processes`, `onboarding_tasks`, `buddies`, `offboarding_templates`, `offboarding_processes`, `offboarding_tasks`, `exit_interviews`, `exit_reasons`.

**KPIs:** % de tareas completadas a tiempo, tiempo promedio de onboarding, satisfacción de ingreso, rotación temprana (<90 días), motivos de salida, tiempo de offboarding.

---

### 5.4 Gestión de personas: hoja de vida y legajo digital

**Objetivo:** administrar toda la información del colaborador en un solo lugar.

**Funcionalidades**
- **Ficha 360 del colaborador** con pestañas: datos personales, contacto y emergencia, familia/beneficiarios, documento de identidad, formación académica, experiencia laboral previa, certificaciones e idiomas, habilidades, datos de vinculación (contrato, cargo, área, sede, jefe, jornada, modalidad), historial de cargos/movimientos (promociones, traslados, cambios de jefe), activos asignados, documentos, ausencias, formación, desempeño, reconocimientos, novedades, salud ocupacional.
- **Legajo digital**: carpeta documental por colaborador con tipos configurables (contrato, cédula, certificados, afiliaciones, exámenes médicos, actas, memorandos), vencimientos (ej. licencia de conducción, certificado de alturas), versiones, visibilidad (HR / jefe / colaborador), solicitud de documentos faltantes con recordatorio.
- **Autoservicio**: el colaborador edita datos designados como editables; cambios sensibles pasan por aprobación de HR y quedan versionados.
- **Movimientos de personal**: promoción, traslado, cambio de jefe, cambio de modalidad, con fecha efectiva, aprobación y actualización automática del organigrama y de accesos.
- **Activos asignados** (laptop, celular, tarjeta, llaves, dotación): inventario simple, asignación/devolución con acta PDF.
- **Organigrama** interactivo (por jerarquía de jefes y por áreas), exportable, con búsqueda.
- **Directorio** de colaboradores con foto, cargo, área, sede, extensión, correo (visibilidad configurable).
- Importación masiva por Excel con plantilla y validación línea a línea; exportación filtrada.
- Cumpleaños y aniversarios (alimenta 5.9).
- Campos personalizados por empresa (`custom_fields` con tipo y validación) en ficha de colaborador y candidato.

**Entidades:** `employees`, `employee_personal_data` (cifrado parcial), `employee_contacts`, `emergency_contacts`, `dependents`, `education`, `work_experience`, `certifications`, `languages`, `skills`, `employee_skills`, `employment_contracts`, `employee_movements`, `documents`, `document_types`, `document_requests`, `assets`, `asset_assignments`, `custom_field_definitions`, `custom_field_values`.

**KPIs:** headcount por área/sede/cargo/tipo de contrato/género/rango de edad/antigüedad, rotación mensual y anual, documentos vencidos/pendientes, movimientos internos, contratos por vencer.

---

### 5.5 Vacaciones, permisos, novedades y procesos

**Objetivo:** gestionar ausencias y eventos del colaborador con flujos de aprobación, sin cálculos de nómina.

**Funcionalidades**
- **Tipos de ausencia configurables**: vacaciones, permiso remunerado/no remunerado, incapacidad (EPS/ARL, con adjunto), licencia de maternidad/paternidad, luto, calamidad, día de cumpleaños, teletrabajo, compensatorio, capacitación, comisión, etc. Cada tipo define: requiere aprobación, requiere adjunto, descuenta saldo, días hábiles o calendario, máximo por solicitud, anticipación mínima.
- **Saldo de vacaciones**: política por empresa (Colombia: 15 días hábiles por año trabajado), acumulación proporcional por fecha de ingreso, ajustes manuales auditados, saldo consumido/pendiente/disponible, proyección. **Solo control de días, nunca valor monetario.**
- **Solicitudes** con flujo de aprobación (jefe → HR, configurable), validación de solapamiento con el equipo, calendario de equipo, cobertura mínima por área, festivos por país (Colombia precargados, editables).
- **Calendario de ausencias** por equipo/área/empresa; sincronización ICS.
- **Novedades del colaborador**: registro de eventos que HR necesita seguir (cambio de datos, incapacidad prolongada, horas extra reportadas informativamente, préstamo de equipo, sanción, felicitación, comisión). Tipos configurables, con adjuntos, flujo y estado.
- **Procesos disciplinarios**: llamado de atención verbal/escrito, descargos (citación, acta, respuesta del colaborador con adjuntos), decisión, suspensión, con plantillas de documentos y plazos legales configurables. Acceso restringido y trazado.
- **Exportación de novedades** a nómina externa (CSV/Excel con formato configurable) por período: ausencias, incapacidades, novedades relevantes. Es la única interfaz con nómina y es de salida.

**Entidades:** `leave_types`, `leave_policies`, `leave_balances`, `leave_balance_adjustments`, `leave_requests`, `holidays`, `employee_events` (novedades), `event_types`, `disciplinary_cases`, `disciplinary_case_steps`, `payroll_exports`.

**KPIs:** ausentismo (%), días de vacaciones acumulados sin disfrutar (riesgo), incapacidades por causa/área, tiempo promedio de aprobación, solicitudes por estado, procesos disciplinarios abiertos.

---

### 5.6 Gestión del tiempo: asistencia, horarios y turnos

**Objetivo:** controlar asistencia y planificar turnos.

**Funcionalidades**
- **Horarios de trabajo** (plantillas semanales) y **turnos** (rotativos, por semana, por día, con reglas de descanso), asignación a colaboradores/áreas, planificador visual (grilla semanal/mensual), intercambio de turnos con aprobación, publicación de turnos con notificación.
- **Marcación** de entrada/salida/pausas desde: web, móvil (PWA) con geolocalización y geocerca por sede, foto opcional, código QR en sede, y API para relojes/biométricos (endpoint de ingestión + importación CSV).
- **Registro de asistencia** diario calculado: llegadas tarde, salidas anticipadas, ausencias sin justificar, horas trabajadas, horas extra informativas (solo conteo, sin valor), cruzado con ausencias aprobadas y festivos.
- Justificaciones por el colaborador con flujo de aprobación; corrección manual por HR auditada.
- **Teletrabajo**: registro de jornada remota y reporte.
- Reportes por período y exportación (alimenta `payroll_exports`).

**Entidades:** `work_schedules`, `schedule_rules`, `shifts`, `shift_assignments`, `shift_swap_requests`, `time_clock_entries`, `attendance_days`, `attendance_justifications`, `geofences`, `clock_devices`.

**KPIs:** puntualidad, ausentismo diario, horas extra informativas por área, cumplimiento de turnos, cobertura por turno.

---

### 5.7 Gestión del talento: capacitación (LMS)

**Objetivo:** optimizar la gestión de capacitaciones con una plataforma de aprendizaje.

**Funcionalidades**
- **Catálogo de cursos**: internos (contenido propio) y externos (proveedor, costo informativo, certificado).
- **Constructor de cursos**: estructura jerárquica curso → módulos → lecciones, con orden arrastrable, prerrequisitos, duración estimada, lección de tipo contenido / cuestionario / tarea con entrega / sesión en vivo / SCORM (fase posterior); certificado PDF al aprobar.
- **Editor de contenido por bloques (estilo WordPress/Gutenberg)** — requisito central del LMS. Cada lección se construye visualmente apilando bloques, sin código. Especificación:
  - **Librería base:** Tiptap (ProseMirror) o Editor.js con esquema de bloques propio; el contenido se persiste como **JSON de bloques versionado** (`lesson_contents.blocks jsonb`, `version`), nunca como HTML crudo. Se renderiza con un componente `BlockRenderer` compartido entre editor y vista del alumno (WYSIWYG real).
  - **Bloques de texto:** párrafo con texto enriquecido (negrita, cursiva, subrayado, tachado, color, resaltado, enlaces, código en línea), encabezados H1–H4, listas (viñetas, numeradas, tareas), cita, callout/aviso (info, éxito, advertencia, error), tabla editable, código con resaltado, separador, columnas (2–4) y acordeón/desplegable.
  - **Bloques de medios:** imagen (subida a S3 por arrastrar/pegar, galería de medios reutilizable por empresa con búsqueda, texto alternativo, pie de foto, alineación, ancho, enlace), galería/carrusel, video subido a S3 (transcodificación a HLS en cola con ffmpeg, controles, marcar "obligatorio ver ≥ X %"), audio, archivo descargable (PDF, DOCX, XLSX) con visor de PDF embebido.
  - **Bloques de embed de terceros (oEmbed + iframe seguro):** YouTube, Vimeo, Loom, **Genially**, **H5P** (iframe de h5p.com/h5p.org y también paquetes `.h5p` subidos y servidos localmente con `h5p-standalone`, con reporte de resultados por xAPI), Google Slides/Docs/Forms, Canva, Figma, Miro, Padlet, Wordwall, Kahoot, Quizizz, Spotify/SoundCloud, Twitter/X, CodePen, Mentimeter, y **embed genérico** pegando URL o código `<iframe>`. Al pegar una URL el editor detecta el proveedor (oEmbed) y crea el bloque automáticamente. Seguridad: lista blanca de dominios configurable por empresa, sanitización del HTML (DOMPurify), iframes con `sandbox` y `allow` mínimos, CSP con `frame-src` dinámico desde la lista blanca.
  - **Bloques interactivos propios:** pregunta rápida (verificación de lectura, no calificada), cuestionario embebido (usa el banco de preguntas), tarjetas flip, pestañas, botón/CTA, línea de tiempo, "antes de continuar" (bloqueo hasta completar acción), encuesta pulse embebida (5.10).
  - **Bloques de plantilla reutilizable (patrones):** guardar un conjunto de bloques como patrón de empresa (ej. "cabecera de curso", "cierre con resumen") e insertarlo en cualquier lección; patrones sincronizados (al editar el patrón cambian todas las instancias) o desacoplados.
  - **Experiencia de edición:** menú `/` para insertar bloques, arrastrar y soltar para reordenar, barra flotante de formato, panel lateral de propiedades del bloque, deshacer/rehacer, autoguardado de borrador cada pocos segundos, vista previa en escritorio/móvil, borrador vs. publicado con historial de versiones y restauración, edición colaborativa básica con bloqueo por lección (o Yjs en fase posterior), duplicar/mover bloques entre lecciones, importar desde DOCX/Markdown/HTML convirtiendo a bloques.
  - **Roles:** `trainer` y `hr_admin` crean/editan; revisión y publicación opcional con workflow (5.16).
  - **Seguimiento:** cada bloque de video/embed/interactivo puede marcar completitud (visto, respondido, xAPI `completed`); la lección se completa cuando todos los bloques obligatorios lo están.
  - **Tablas adicionales:** `media_library`, `media_folders`, `content_patterns`, `lesson_content_versions`, `embed_providers` (dominio, plantilla oEmbed, activo por empresa), `xapi_statements`.
  - El mismo editor de bloques se reutiliza en la **wiki, políticas, comunicados del feed y plantillas de documentos** (5.9, 5.12), de modo que hay un único editor en toda la plataforma.
- **Rutas de aprendizaje** por cargo/área; cursos obligatorios con fecha límite y recertificación periódica (ej. SST anual).
- Inscripción manual, masiva, por regla (todos los nuevos ingresos), o autoinscripción desde catálogo.
- **Sesiones presenciales/virtuales**: fecha, lugar/enlace, cupos, lista de asistencia (QR), instructor interno o externo.
- Seguimiento: progreso, calificaciones, intentos, tiempo, encuesta de satisfacción del curso, evaluación de eficacia (el jefe evalúa aplicación a los 60 días).
- **Plan anual de capacitación**: necesidades detectadas (desde evaluaciones de desempeño y brechas de competencias), presupuesto informativo, ejecución.
- Matriz de habilidades/competencias por colaborador (alimentada por cursos y evaluaciones).

**Entidades:** `courses`, `course_modules`, `lessons`, `lesson_contents`, `quizzes`, `questions`, `question_options`, `quiz_attempts`, `assignments_lms`, `learning_paths`, `enrollments`, `lesson_progress`, `training_sessions`, `session_attendance`, `certificates`, `training_plans`, `training_needs`, `course_feedback`.

**KPIs:** horas de formación por colaborador, cumplimiento de cursos obligatorios, tasa de finalización, calificación promedio, cobertura de formación por área, costo informativo ejecutado vs plan.

---

### 5.8 Gestión del desempeño, objetivos y desarrollo

**Objetivo:** evaluaciones 90°/180°/360°, objetivos (OKR/KPI), competencias, feedback continuo y planes de acción/carrera.

**Funcionalidades**
- **Modelo de competencias** por empresa: diccionario de competencias con niveles y comportamientos observables; asignación de competencias requeridas por cargo.
- **Objetivos (OKR / metas SMART)**: objetivos de empresa → área → equipo → individuo (árbol alineado), resultados clave con métrica, meta, avance y check-ins periódicos, ponderación, estado, comentarios. Ciclos (trimestral/anual).
- **Ciclos de evaluación** configurables: tipo (90° autoevaluación+jefe, 180° +pares, 360° +reportes+clientes internos), plantilla de formulario (competencias, objetivos, preguntas abiertas, escala), selección de evaluadores (automática por organigrama + manual + nominación por el evaluado con aprobación), etapas con fechas (autoevaluación, evaluación, calibración, reunión de feedback, cierre), anonimato configurable para pares/reportes.
- **Calibración**: sesión donde HR/gerencia ajusta distribuciones; matriz 9-box (desempeño × potencial).
- **Resultados**: informe individual PDF, comparativo por área, brechas de competencias, ranking (solo visible a roles autorizados).
- **Feedback continuo**: cualquier colaborador puede dar/pedir feedback (público o privado), reconocimiento (integra 5.9), 1:1 con agenda, notas y acuerdos.
- **Planes de acción / PDI** (plan de desarrollo individual): acciones, responsables, fechas, seguimiento; vinculan cursos del LMS.
- **Plan de carrera y sucesión**: rutas de carrera entre cargos, requisitos, candidatos a sucesión por cargo crítico con nivel de preparación.
- **Búsquedas internas**: publicar vacantes primero al interior; postulación desde el portal (reutiliza ATS con visibilidad interna).

**Entidades:** `competencies`, `competency_levels`, `position_competencies`, `objective_cycles`, `objectives`, `key_results`, `kr_checkins`, `review_cycles`, `review_templates`, `review_assignments`, `review_responses`, `calibration_sessions`, `nine_box_placements`, `feedback`, `one_on_ones`, `development_plans`, `development_actions`, `career_paths`, `succession_plans`, `succession_candidates`.

**KPIs:** cumplimiento de objetivos, distribución de desempeño, brechas de competencias por área, % de evaluaciones completadas, 9-box, planes de desarrollo activos, cobertura de sucesión en cargos críticos.

---

### 5.9 Comunicación interna, cultura y reconocimiento

**Objetivo:** informar novedades y fortalecer la comunicación mediante un portal interactivo; destacar logros y trabajo en equipo.

**Funcionalidades**
- **Muro / feed** de la empresa: publicaciones (noticias, comunicados, eventos) con editor enriquecido, imágenes, adjuntos, audiencia (toda la empresa, sede, área, rol), programación, fijadas, confirmación de lectura obligatoria (para comunicados importantes), reacciones y comentarios (moderables).
- **Eventos** con calendario, inscripción y recordatorios.
- **Cumpleaños y aniversarios** automáticos con felicitación pública (opt-out por el colaborador).
- **Reconocimientos**: cualquier colaborador reconoce a otro asociándolo a un valor corporativo; muro de reconocimientos; puntos/insignias opcionales y ranking; reconocimiento formal por HR con certificado.
- **Beneficios**: catálogo de beneficios de la empresa (convenios, descuentos, bienestar) con solicitud/inscripción.
- **Librería de conocimiento / Wiki**: artículos por categoría, versionados, búsqueda; políticas con acuse de lectura y firma (integra 5.12).
- **Encuestas rápidas (pulse)** embebidas en el feed (integra 5.10).
- Chat interno 1:1 y grupal simple (fase posterior; no es prioridad frente a Teams/Slack/WhatsApp).

**Entidades:** `posts`, `post_audiences`, `post_reads`, `post_reactions`, `post_comments`, `events`, `event_registrations`, `recognitions`, `company_values`, `badges`, `employee_badges`, `benefits`, `benefit_enrollments`, `wiki_articles`, `wiki_categories`.

**KPIs:** alcance y lectura de comunicados, participación (reacciones, comentarios), reconocimientos por valor/área/mes, asistencia a eventos, uso de beneficios.

---

### 5.10 Encuestas y clima organizacional

**Objetivo:** encuestas personalizadas ilimitadas con análisis para decisiones sobre cultura y clima.

**Funcionalidades**
- **Constructor de encuestas** (motor de formularios): tipos de pregunta (opción única/múltiple, escala Likert, NPS, matriz, abierta, ranking, fecha, archivo), lógica condicional, secciones, obligatoriedad, plantillas (clima, eNPS, pulso semanal, satisfacción de onboarding, salida, evaluación de curso).
- Audiencia por filtros (área, sede, cargo, antigüedad), anónima o identificada (con umbral mínimo de respuestas para mostrar resultados por segmento, ej. ≥5, para proteger anonimato), programación y recurrencia, recordatorios.
- **Análisis**: tasa de respuesta, resultados por pregunta y segmento, comparación entre períodos, eNPS, nube de palabras/temas en respuestas abiertas (heurística; interfaz para LLM), exportación.
- Planes de acción derivados de resultados (reutiliza `development_actions` a nivel de área).

**Entidades:** `surveys`, `survey_versions`, `survey_questions`, `survey_audiences`, `survey_invitations`, `survey_responses`, `survey_answers`, `survey_templates`.

**KPIs:** tasa de participación, eNPS, índice de clima por dimensión, evolución temporal, segmentos en alerta.

---

### 5.11 Canal de denuncias (línea ética) **[ampliado]**

**Objetivo:** recibir y gestionar denuncias por un medio seguro y confiable para colaboradores, clientes, proveedores y terceros.

**Funcionalidades**
- **Portal público** `/ethics/:companySlug` sin login: formulario configurable, categoría (acoso, discriminación, fraude, conflicto de interés, seguridad, otro), descripción, adjuntos, opción anónima o identificada, relación con la empresa.
- Al enviar se genera un **código de seguimiento + clave** para consultar estado y dialogar con el investigador **sin revelar identidad** (buzón bidireccional anónimo).
- **Gestión del caso**: asignación a `ethics_officer` (comité), clasificación de gravedad, exclusión automática de implicados (si el denunciado es del comité, no ve el caso), plan de investigación, entrevistas, evidencias, conclusiones, medidas, cierre con informe; plazos y SLA configurables; escalamiento.
- Cifrado de contenido; sin almacenar IP/UA en reportes anónimos; registro de cada acceso al caso.
- Estadísticas agregadas (nunca detalle) para gerencia y analítica.
- Compatible con lineamientos ISO 37002 y Ley 2466/2025 (Colombia, prevención de acoso laboral) — configurar categorías y plazos según normativa local.

**Entidades:** `ethics_reports`, `ethics_report_messages`, `ethics_cases`, `ethics_case_members`, `ethics_case_actions`, `ethics_evidence`, `ethics_categories`.

**KPIs:** casos por categoría/gravedad/estado, tiempo de respuesta y de cierre, % anónimos, reincidencia por área (agregado).

---

### 5.12 Documentos, políticas y firma

**Objetivo:** centralizar documentos institucionales y personales con acuse y firma.

**Funcionalidades**
- Plantillas de documentos con variables (`{{employee.full_name}}`, `{{position.name}}`…) para certificados laborales, cartas, actas, contratos de referencia; generación PDF individual o masiva.
- **Certificado laboral de autoservicio**: el colaborador lo genera solo (plantilla aprobada por HR, con código QR de verificación pública).
- Políticas y reglamentos con versión, publicación a audiencia, acuse de lectura obligatorio y firma simple (nombre + fecha + hash + IP) o integración con firma certificada externa (interfaz `SignatureProvider`).
- Repositorio institucional (organigrama oficial, manuales, formatos) integrado con la wiki.

**Entidades:** `document_templates`, `generated_documents`, `policies`, `policy_versions`, `policy_acknowledgements`, `signature_requests`, `signatures`.

---

### 5.13 Servicio al colaborador (help desk multicanal)

**Objetivo:** centralizar todos los canales de comunicación con los colaboradores en un centro de ayuda.

**Funcionalidades (fase 1)**
- **Tickets**: categorías (certificados, vacaciones, datos, TI, beneficios, nómina —solo redirección—, otro), prioridad, SLA por categoría, asignación por reglas (categoría → equipo/agente), estados, comentarios internos vs públicos, adjuntos, plantillas de respuesta (macros), satisfacción al cerrar (CSAT).
- **Centro de ayuda**: base de conocimiento (FAQ) con búsqueda; sugerencia de artículos antes de crear ticket.
- Chat en vivo desde el portal (Socket.IO) que crea/continúa un ticket.
- Bandeja unificada por agente con vistas y filtros.

**Funcionalidades (fase 2, integraciones)**
- Correo entrante: buzón compartido de **Gmail** (Gmail API) y **Outlook** (Microsoft Graph) → tickets; respuesta desde la plataforma.
- **WhatsApp** (Meta Cloud API) → tickets y notificaciones.
- Redes sociales (Meta Messenger/Instagram) por adaptador `ChannelAdapter`.
- Diseñar desde fase 1 la abstracción `ChannelAdapter { inbound(), outbound() }` para que los canales sean conectables.

**Entidades:** `tickets`, `ticket_categories`, `ticket_messages`, `ticket_assignments`, `sla_policies`, `macros`, `kb_articles`, `channels`, `channel_messages`, `csat_responses`.

**KPIs:** tickets por categoría, tiempo de primera respuesta, tiempo de resolución, cumplimiento de SLA, CSAT, backlog, tickets por agente, temas recurrentes.

---

### 5.14 Seguridad y Salud en el Trabajo (SST) **[+]**

**Objetivo:** cubrir la obligación legal (Colombia: Decreto 1072/2015, Resolución 0312/2019) que toda empresa tiene y que ninguno de los módulos pedidos cubría.

**Funcionalidades**
- Exámenes médicos ocupacionales (ingreso, periódico, retiro) con vencimientos y concepto (apto/no apto con restricciones; contenido cifrado).
- Registro de accidentes e incidentes de trabajo (FURAT informativo, investigación, plan de acción), enfermedades laborales.
- Matriz de riesgos/peligros por cargo y sede (registro simple), EPP entregados (acta), inspecciones y capacitaciones SST (integra LMS), COPASST y comité de convivencia (actas, integrantes, vigencia).
- Indicadores mínimos de la Resolución 0312 calculados automáticamente (frecuencia, severidad, ausentismo por causa médica).

**Entidades:** `medical_exams`, `work_accidents`, `accident_investigations`, `risk_matrix_entries`, `ppe_deliveries`, `sst_inspections`, `committees`, `committee_members`, `committee_minutes`.

---

### 5.15 Portal del empleado (autoservicio)

**Objetivo:** un solo lugar, móvil primero (PWA instalable), donde el colaborador hace todo.

**Contenido del portal**
- Inicio: saludo, marcación rápida, próximas tareas (onboarding, cursos, evaluaciones, encuestas, firmas), solicitudes en curso, feed de la empresa, cumpleaños, reconocimientos, accesos rápidos configurables por la empresa.
- Mi perfil / mis datos / mis documentos / mis certificados / mis activos.
- Mis solicitudes: vacaciones, permisos, certificados, tickets, cambios de datos.
- Mi equipo (si es jefe): aprobaciones pendientes, calendario de ausencias, asistencia, objetivos y evaluaciones de sus reportes, onboarding de nuevos ingresos.
- Mi desarrollo: cursos, objetivos, evaluaciones, feedback, PDI, plan de carrera, búsquedas internas.
- Directorio y organigrama.
- Notificaciones (centro con preferencias por canal).
- **Módulos visibles configurables** por rol/usuario (5.1).

---

### 5.16 Motores transversales

**Workflows (aprobaciones)**
- Definición por empresa y por tipo de objeto: pasos secuenciales/paralelos, aprobador por rol relativo (jefe directo, jefe del jefe, HR, rol específico, usuario), condiciones (ej. >10 días requiere 2 niveles), acciones automáticas al aprobar/rechazar, recordatorios y escalamiento por tiempo, delegación.
- Tablas: `workflow_definitions`, `workflow_steps`, `workflow_instances`, `workflow_step_instances`, `workflow_actions`.
- Bandeja única de aprobaciones para el aprobador.

**Notificaciones**
- Canales: in-app (realtime), email, push PWA, WhatsApp/SMS (proveedor conectable). Plantillas por evento con variables; preferencias por usuario; digest diario opcional; recordatorios programados (BullMQ).
- Tablas: `notification_templates`, `notifications`, `notification_preferences`, `notification_deliveries`.

**Formularios dinámicos**
- Esquema JSON versionado, render en frontend con componente único, validación Zod generada, usado por encuestas, evaluaciones, checklists, formularios de postulación, formularios de operaciones ad hoc.
- Tablas: `forms`, `form_versions`, `form_submissions`.

**Archivos**
- `files` (metadata, S3 key, mime, size, hash, owner, visibility, virus_scan_status), URLs prefirmadas de subida/descarga, vinculación polimórfica `file_links(entity_type, entity_id)`.

**Integraciones y API pública**
- Webhooks salientes por evento (`employee.created`, `leave.approved`, …) con firma HMAC y reintentos.
- API keys por empresa con alcance de permisos para integraciones (biométricos, nómina externa, BI).
- Conectores previstos: Google Workspace / Microsoft 365 (SSO, calendario, correo), WhatsApp Cloud API, LinkedIn/Computrabajo (publicación), Slack/Teams (notificaciones), relojes biométricos (ZKTeco por API/CSV).

---

### 5.17 Analítica de datos y reportes

**Objetivo:** sistema de analítica completo sobre todos los elementos relevantes.

**Funcionalidades**
- **Dashboard ejecutivo** (gerencia/HR): headcount y su evolución, rotación (voluntaria/involuntaria), ausentismo, vacantes abiertas y tiempo de cobertura, cumplimiento de formación obligatoria, desempeño y distribución 9-box, eNPS/clima, tickets y SLA, denuncias (agregado), documentos y contratos por vencer, cumpleaños del mes, alertas.
- **Dashboards por módulo** con los KPIs listados en cada sección, filtros globales (período, sede, área, cargo, tipo de contrato, género, antigüedad) y comparación entre períodos.
- **Dashboard del jefe**: su equipo (asistencia, ausencias, objetivos, evaluaciones, formación, reconocimientos).
- **Constructor de reportes**: el usuario elige entidad, columnas, filtros, agrupación y gráfico; guarda, comparte y programa envío por email (PDF/XLSX). Basado en un catálogo de "datasets" seguros (vistas SQL) respetando permisos y alcance.
- **Alertas y predicciones básicas**: riesgo de rotación (heurística: antigüedad, ausentismo, desempeño, encuestas, sin aumento de cargo), vencimientos, saldos de vacaciones altos, cursos vencidos.
- Exportación de cualquier tabla a XLSX/CSV; PDF de dashboards.
- Implementación: vistas materializadas refrescadas por cron (BullMQ) + tabla de hechos `hr_snapshots` (snapshot diario de headcount por dimensión) para series históricas; endpoints `/analytics/*`; Recharts en frontend. Dejar interfaz para conectar Metabase/Power BI vía usuario de solo lectura en PostgreSQL.

**Entidades:** `hr_snapshots`, `report_definitions`, `report_schedules`, `report_runs`, `analytics_alerts`.

---

## 6. Modelo de datos — núcleo (referencia rápida)

Detalle completo debe generarse en `schema.prisma` y documentarse en `docs/DATA_MODEL.md` con diagrama Mermaid ER por módulo. Núcleo:

```
companies 1───* company_users *───1 users
companies 1───* locations
companies 1───* departments (parent_id)
companies 1───* positions (reports_to_position_id)
companies 1───* employees (manager_id → employees.id, user_id → users.id)
employees 1───* employment_contracts
employees 1───* employee_movements
employees 1───* documents ─── files
roles *───* permissions ; roles *───* modules ; users *───* modules (override)
workflow_definitions 1───* workflow_instances (polymorphic: entity_type, entity_id)
forms 1───* form_versions 1───* form_submissions
files 1───* file_links (polymorphic)
audit_logs (polymorphic)
```

Índices obligatorios: `(company_id, deleted_at)` en todas las tablas; `pg_trgm` en nombres y texto de CV; `btree_gist` para exclusión de solapamiento de ausencias por colaborador.

---

## 7. API — convenciones y ejemplos

```
POST   /api/v1/auth/login | /refresh | /logout | /2fa/verify
GET    /api/v1/me  (usuario, empresa activa, permisos efectivos, módulos visibles)
GET    /api/v1/employees?filter[department_id]=&filter[status]=active&search=&page=&limit=&sort=-hired_at
POST   /api/v1/employees
GET    /api/v1/employees/:id   (respuesta según alcance del permiso)
POST   /api/v1/leaves/requests → crea workflow_instance
POST   /api/v1/workflows/instances/:id/approve | /reject | /delegate
GET    /api/v1/analytics/executive?from=&to=&location_id=
POST   /api/v1/public/careers/:companySlug/jobs/:jobId/apply   (público, rate-limited)
POST   /api/v1/public/ethics/:companySlug/reports               (público, sin logs de IP)
```

- Todos los endpoints con `@RequirePermission` y `@Scope`.
- Errores de negocio con códigos estables (`LEAVE_OVERLAP`, `INSUFFICIENT_BALANCE`, `WORKFLOW_STEP_NOT_ALLOWED`).
- Swagger en `/api/docs` (solo entornos no productivos o protegido).

---

## 8. Frontend — lineamientos de UX/UI

- Diseño limpio, moderno, con espacios amplios, tipografía Inter, esquinas suaves, componentes shadcn/ui; tema claro/oscuro; colores de marca por empresa (white-label: logo, color primario, favicon).
- Layout: barra lateral colapsable con módulos (dinámica según permisos), barra superior con buscador global (colaboradores, documentos, artículos, tickets), selector de empresa, notificaciones, perfil.
- Tablas con filtros persistentes en URL, columnas configurables, exportación, acciones masivas, estados vacíos con guía.
- Formularios por pasos para procesos largos; guardado automático de borradores.
- Vistas Kanban (ATS, tickets), calendarios (ausencias, turnos, eventos), organigrama (react-flow o d3), grillas de turnos.
- Accesibilidad AA, navegación por teclado, i18n completa (es por defecto).
- PWA instalable; portal del empleado optimizado para móvil (marcación, solicitudes, feed, notificaciones push).
- Skeletons, optimistic updates, manejo de errores amigable.

---

## 9. Despliegue en EC2

- Instancia recomendada inicial: t3.medium (2 vCPU / 4 GB) con Docker; escalar a t3.large o separar PostgreSQL a RDS cuando haya > ~300 usuarios activos.
- `docker-compose.prod.yml`: `api`, `web` (build estático servido por nginx), `postgres` (volumen EBS), `redis`, `minio` (o S3 real), `nginx` (reverse proxy, TLS Let's Encrypt, gzip, cache estático), `worker` (BullMQ), `cron`.
- Variables de entorno en `.env` (plantilla `.env.example` completa y comentada).
- Scripts: `infra/scripts/deploy.sh` (pull, build, migrate, restart con cero downtime básico), `backup.sh` (pg_dump + sync S3), `restore.sh`.
- Logs a stdout (JSON) → CloudWatch opcional. Healthchecks en compose.
- GitHub Actions: en push a `main` → tests → build imágenes → SSH deploy.

---

## 10. Datos semilla (seed) y entorno demo

Crear `pnpm seed:demo` que genere una empresa demo realista ("Demo S.A.S.", Barranquilla) con: 3 sedes, 8 áreas, 25 cargos, 120 colaboradores con jerarquía, contratos, documentos, 6 vacantes con candidatos en distintas etapas, plantillas de onboarding, tipos de ausencia y festivos de Colombia 2026-2027, saldos de vacaciones, 3 meses de asistencia, 10 cursos con inscripciones, un ciclo de evaluación 360 en curso, competencias, objetivos, 2 encuestas (clima y eNPS) con respuestas, posts, reconocimientos, tickets, 3 denuncias de prueba, datos SST y snapshots de analítica para 12 meses. Usuarios demo: `admin@demo.com`, `hr@demo.com`, `manager@demo.com`, `empleado@demo.com`, `etica@demo.com` (contraseña `Demo1234!`).

---

## 11. Calidad y pruebas

- Lint + typecheck en pre-commit (husky, lint-staged).
- Cobertura mínima: servicios críticos (auth, permisos, workflows, saldos de vacaciones, asistencia, anonimato de denuncias) ≥ 80 %.
- Pruebas e2e API por módulo (happy path + permisos denegados + tenant aislado: un usuario de la empresa A nunca ve datos de B).
- Pruebas Playwright para: login, solicitar y aprobar vacaciones, postulación pública y contratación, marcación, responder encuesta, enviar denuncia anónima y consultar por código.
- Prueba de carga básica (k6) sobre endpoints de listado y marcación.

---

## 12. Plan de fases (orden de construcción)

**Fase 0 — Cimientos (semana 1-2)**
Monorepo, Docker, CI, NestJS + Prisma + PostgreSQL + Redis, React + Vite + Tailwind + shadcn, auth completa (JWT, refresh, 2FA, recuperación, SSO OIDC preparado), multi-tenancy, usuarios/roles/permisos/módulos, auditoría, archivos S3, notificaciones in-app + email, i18n, layout base con menú dinámico, settings de empresa (white-label). Seed mínimo.

**Fase 1 — Personas (semana 3-4)**
Modelo organizacional (sedes, áreas, cargos), colaboradores (ficha 360), contratos, movimientos, legajo digital, activos, campos personalizados, importación Excel, organigrama, directorio, portal del empleado v1 (perfil, documentos, directorio). Motor de workflows. Motor de formularios.

**Fase 2 — Tiempo y ausencias (semana 5-6)**
Tipos de ausencia, políticas y saldos de vacaciones, solicitudes con workflow, calendario, festivos, novedades, procesos disciplinarios, exportación a nómina externa. Horarios, turnos, marcación (web/PWA/QR/geocerca), asistencia diaria, justificaciones, ingestión de biométricos por CSV/API.

**Fase 3 — Reclutamiento y ciclo de ingreso/salida (semana 7-9)**
ATS completo: requisiciones, vacantes, portal público de empleos, pipeline, candidatos, entrevistas y scorecards, ofertas, referidos, contratación → onboarding. Onboarding y offboarding con plantillas, pre-onboarding, buddy, entrevista de retiro.

**Fase 4 — Talento (semana 10-13)**
Editor de contenido por bloques (texto, medios, embeds YouTube/Vimeo/Genially/H5P/genérico, patrones, versiones, galería de medios). LMS (cursos, lecciones, quizzes, rutas, sesiones, certificados, plan de capacitación). Competencias, objetivos/OKR, ciclos de evaluación 90/180/360, calibración, 9-box, feedback continuo, 1:1, PDI, plan de carrera, sucesión, búsquedas internas.

**Fase 5 — Cultura, voz y servicio (semana 14-16)**
Feed/comunicados, eventos, cumpleaños, reconocimientos, beneficios, wiki y políticas con acuse/firma, plantillas de documentos y certificado laboral de autoservicio. Encuestas y clima. Canal de denuncias. Help desk (tickets, KB, chat) con abstracción de canales.

**Fase 6 — SST y analítica (semana 17-19)**
Módulo SST. Snapshots, vistas materializadas, dashboards ejecutivo/por módulo/jefe, constructor de reportes, programación de reportes, alertas y riesgo de rotación.

**Fase 7 — Integraciones y endurecimiento (semana 20-22)**
Gmail/Outlook/WhatsApp en help desk, calendario Google/Microsoft, publicación en portales de empleo, webhooks y API keys, SCORM, ClamAV, pruebas de carga, revisión de seguridad (OWASP), documentación final, manual de usuario y de administrador, despliegue productivo en EC2 con backups verificados.

Cada fase termina con demo funcional en la instancia y checklist de aceptación en `docs/ACCEPTANCE.md`.

---

## 13. Criterios de aceptación globales

1. Un usuario de una empresa no puede ver ni inferir datos de otra (probado).
2. Ningún endpoint sin permiso; ninguna pantalla muestra módulos no asignados.
3. Toda acción de escritura relevante aparece en auditoría con diff.
4. Denuncia anónima: imposible vincular a la persona desde base de datos o logs.
5. Solicitud de vacaciones: no permite solapamiento, valida saldo, notifica, se aprueba desde bandeja y se refleja en calendario y asistencia.
6. Contratar un candidato crea colaborador, usuario, legajo y onboarding sin intervención manual.
7. Ciclo 360 completo de extremo a extremo con informe PDF.
8. Dashboard ejecutivo carga en < 2 s con la empresa demo.
9. Portal del empleado usable en móvil (Lighthouse PWA ≥ 90).
10. Despliegue reproducible en EC2 limpia con un solo script y `.env`.

---

## 14. Glosario mínimo

- **ATS**: Applicant Tracking System (seguimiento de candidatos).
- **LMS**: Learning Management System.
- **OKR**: Objectives and Key Results.
- **PDI**: Plan de Desarrollo Individual.
- **SST**: Seguridad y Salud en el Trabajo.
- **9-box**: matriz desempeño × potencial.
- **eNPS**: Employee Net Promoter Score.
- **Legajo**: carpeta documental del colaborador.
- **Novedad**: evento del colaborador que HR registra y sigue (sin efecto contable en esta plataforma).
