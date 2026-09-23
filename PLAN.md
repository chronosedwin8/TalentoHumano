# Plan de trabajo

Estado por fase de la especificacion (`TALENTO_HR_SPEC.md`, seccion 12) y el
detalle de lo que sigue abierto tras la revision del 23 de septiembre de 2026.
`CHANGELOG.md` registra lo construido en cada entrega; `docs/ACCEPTANCE.md`,
la evidencia de los diez criterios.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Monorepo, base de datos, autenticacion, permisos, auditoria, cifrado, archivos, notificaciones, i18n, CI | Completa |
| 1 | Personas y organizacion, legajo, movimientos, activos, importacion | Completa en API (importacion desde Excel el 23-09); falta la pantalla de importacion |
| 2 | Seleccion, onboarding y offboarding | Completa en API; ver pendientes de pantalla |
| 3 | Ausencias, novedades, procesos, tiempo y asistencia | Completa en API; ver pendientes de pantalla |
| 4 | Formacion (LMS) con editor de bloques, desempeno y OKR | Completa en API; ver pendientes |
| 5 | Comunicacion, encuestas, canal de denuncias, documentos, help desk, SST | Completa; ver pendientes |
| 6 | Analitica, reportes, alertas, planificador | Completa (planificador el 23-09) |
| 7 | Portal, PWA, despliegue, datos demo, documentacion | Completa; despliegue verificado por imagenes, no en EC2 |

## Pendientes por modulo

Ordenados por el impacto que tienen en el uso diario. Cada linea nombra la
API que ya existe y lo que falta encima.

### Seleccion

- Pantalla de referidos (`/recruiting/referrals`; la API ya acepta referir desde la sesion).
- Configuracion de etapas y acciones masivas en el tablero.
- Feed XML/JSON del portal de empleo y extraccion de texto de hojas de vida
  (`pdf-parse` y `mammoth` estan instalados y sin uso).

### Onboarding y offboarding

- Dialogo "Iniciar proceso" (`POST /onboarding/processes`) y panel de
  devoluciones de activos en procesos de salida.
- Formularios del pre-ingreso en `PreboardingPage` (la API ya acepta datos de
  contacto, documentos y cierre de tareas con el enlace temporal).
- `terminate` con fecha futura: hoy desactiva de inmediato; falta diferir la
  desactivacion a la fecha efectiva y abrir el proceso de salida.

### Personas

- Ficha 360: familia, experiencia, certificaciones e idiomas (modelos sin
  endpoint), ausencias, desempeno, reconocimientos, novedades y salud.
- Campos personalizados editables en el formulario y aplicados a candidatos.
- Procesos disciplinarios (`/leaves/disciplinary`) sin pantalla.
- Exportacion del organigrama y visibilidad configurable del directorio.

### Ausencias y tiempo

- Turnos: asignacion, intercambios y publicacion desde `ShiftsPage`
  (`/time/shifts/*`, `/time/shifts/publish`).
- Geocercas, dispositivos e importacion de marcaciones desde la interfaz;
  el colaborador aun no crea justificaciones desde su asistencia.
- Cobertura minima por area y sincronizacion ICS del calendario.

### Formacion y desempeno

- Rutas de aprendizaje, plan anual y sesiones con asistencia (API lista).
- Satisfaccion y eficacia a 60 dias (`CourseFeedback` sin endpoint).
- 1:1, PDI, carrera y sucesion (API lista, sin pantalla). Competencias por
  cargo y sesiones de calibracion (modelos sin endpoint). Informe 360 en PDF.

### Comunicacion y encuestas

- Eventos con inscripcion (API lista). Publicaciones programadas: la fecha se
  guarda y falta el trabajo que las publique. Ranking de reconocimientos.
- Constructor visual de encuestas, logica condicional en el formulario de
  respuesta, recurrencia y recordatorios, comparacion entre periodos y
  exportacion.

### Motores y configuracion

- Flujos de aprobacion y plantillas de notificacion desde Configuracion
  (API lista, incluidas las plantillas por empresa).
- Preferencias de notificacion del usuario, sobreescritura de modulos por
  usuario, delegaciones y sesiones remotas desde la interfaz (API lista).
- Push PWA, SSO OIDC (solo variables), digest diario, chat en vivo del help
  desk en el navegador (el servidor ya emite `ticket.message`).

### Analitica

- Filtros globales por sede, area, cargo y genero en los tableros; tablero del
  jefe (`GET /analytics/team`) sin pantalla; programacion de reportes desde la
  interfaz (el planificador ya los envia).

## Como se trabaja cada pendiente

1. Leer la pantalla mas parecida y reutilizar sus componentes.
2. Solo permisos existentes (`packages/shared/src/permissions.ts`).
3. Texto de interfaz en espanol; codigo y comentarios en ingles.
4. `pnpm -r typecheck && pnpm -r lint && pnpm test`, e2e de API si toca la
   API, Playwright si toca un flujo cubierto.
5. Anotar en `CHANGELOG.md` y en `docs/MODULES/<modulo>.md`.
