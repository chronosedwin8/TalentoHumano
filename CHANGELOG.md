# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.1.0] — 2026-09-23

Revision de salida a produccion: auditoria de la especificacion modulo por
modulo, caceria de defectos en API y web, y verificacion real del despliegue
(construccion y arranque de las imagenes). Lo encontrado se corrigio; lo que
sigue abierto esta en `docs/ACCEPTANCE.md` y en `PLAN.md`.

### Corregido

- **Descargas con almacenamiento local siempre fallaban.** La ruta publica
  `GET /files/download` estaba declarada despues de `GET /files/:id`, asi que
  Express la atrapaba con el guard de sesion y el validador de uuid. Ahora se
  registra antes y hay prueba de regresion.
- **Diez eliminaciones respondian 422.** `softDelete` escribia `updatedById`
  en modelos que no tienen esa columna (tipos de ausencia, encuestas,
  objetivos, plantillas, reportes, novedades, campos personalizados, centros
  de costo, documentos del legajo). Se quito el argumento en esos casos; la
  auditoria conserva quien elimino.
- **Acuses de politica y actualizacion de vacantes.** `PolicyAcknowledgement`
  no tiene relacion `employee` (se une en una segunda consulta) y
  `competencyIds` no es una columna de la vacante (se guarda como relacion).
- **Selector de colaborador.** `ids` y `scope=team` no existian en la API:
  el selector mostraba a la primera persona por orden alfabetico en vez de la
  seleccionada, y el modo equipo listaba a toda la empresa. Ademas `position`
  llega como objeto y dos dialogos (generar documento, asignar ticket) se
  caian al renderizarlo.
- **Campos que el web leia y la API no devuelve:** `alert.description`
  (es `detail`), `risk.factors` (es `reasons`, y la pestana de riesgo de
  rotacion rompia toda la pagina de analitica), `row.actor`/`row.ipAddress`
  en auditoria (son `actorEmail`/`ip`: el usuario siempre salia "Sistema").
- **Literales que no coincidian con los enums:** el filtro de modalidad del
  portal de empleo (`presencial/hibrido/remoto` contra `onsite/hybrid/remote`)
  dejaba el portal vacio; las entregas de webhook exitosas se pintaban en rojo
  (`success` contra `sent`).
- **Autoguardado del editor de lecciones** sobreescribia lo tecleado entre el
  guardado y el refetch. El servidor solo siembra el editor una vez por
  leccion.
- **Correo personal vacio** en "Mi perfil" devolvia 422: ahora se envia `null`.
- **Ticket sin asignar visible para usuarios sin colaborador:** `null === null`
  en la comparacion de asignado concedia acceso.
- **Filtros de enumeraciones** (`status`, `kind`, `gender`) sin validar
  producian un 422 generico de Prisma; ahora responden con el campo y los
  valores permitidos (`enumQuery`).
- **N+1 en rutas calientes:** `GET /leaves/balances` hacia siete consultas por
  colaborador (hasta 3500 en una peticion) y escribia en cada lectura; ahora
  lee los saldos almacenados en cuatro consultas y solo recalcula el devengo.
  `GET /analytics/turnover-risk` ya no persiste alertas (lo hace
  `POST /analytics/alerts/run`, por lotes) y el legajo carga los archivos en
  una sola consulta.
- **`/health` devolvia 200 con la base de datos caida.** Ahora 503, que es lo
  que leen el `HEALTHCHECK` de Docker y `deploy.sh`.
- **Errores de Prisma sin mapear:** la restriccion de exclusion de ausencias
  llega como `PrismaClientUnknownRequestError` (ahora 409 `LEAVE_OVERLAP`) y la
  base inaccesible como error de inicializacion (ahora 503).

### Motores

- **Planificador.** No existia ningun `@Cron`: recordatorios, escalamientos,
  snapshots, reportes programados y anonimizacion solo corrian a mano. Ahora
  `SchedulerService` los ejecuta con un candado consultivo de PostgreSQL para
  que una sola replica los corra: snapshot y alertas diarias, recordatorios y
  escalamiento de onboarding, SLA de aprobaciones (recordatorio y luego
  escalamiento al usuario configurado), denuncias fuera de plazo, reportes
  programados (con lector de cron propio) y retencion de candidatos.
- **Las API keys ahora autentican.** Se creaban pero ningun guard las aceptaba.
  `X-Api-Key` resuelve un contexto con los permisos de la clave a alcance de
  empresa, sin sesion.
- **Webhooks con reintentos:** cinco intentos con retroceso exponencial.
- **Tiempo real en el cliente:** `socket.io-client` estaba instalado y sin
  usar. Las notificaciones llegan sin sondeo y los tickets se refrescan al
  recibir mensajes.
- **Trabajos en cola:** con `REDIS_ENABLED=true` nadie consumia las colas
  (`startWorkers` no se llamaba y `dist/worker.js` no existia). La API los
  consume por defecto (`QUEUE_WORKERS`) y hay un proceso dedicado.

### API

- Importacion masiva desde Excel real (`{ fileId }` ademas de `{ rows }`, con
  ensayo), plantilla XLSX con hoja de catalogos y exportacion XLSX del listado
  sin columnas sensibles.
- Reclutamiento: ficha del candidato, detalle de entrevista con evaluacion
  ciega, listado y envio real de ofertas por correo con enlace de respuesta,
  correos automaticos por etapa, referidos desde la sesion, configuracion de
  etapas con proteccion de las que tienen historial.
- Plantillas de notificacion por empresa (`/notifications/templates`),
  sesiones de otros usuarios para administradores, delegaciones con nombres.
- Pre-ingreso: el nuevo colaborador completa datos de contacto, sube documentos
  y cierra sus tareas con el enlace temporal; el ingreso inscribe en los cursos
  de las tareas, crea seguimientos 30/60/90 y escala tareas vencidas.
- Tiempo: publicacion de turnos con aviso, exportacion CSV de asistencia y
  resumen de teletrabajo.

### Despliegue

- **La imagen de la API no arrancaba** (`Cannot find module 'zod'`): el
  `Dockerfile` no copiaba `packages/shared/node_modules`. Ahora hay una etapa
  de dependencias de produccion y `prisma` es dependencia de ejecucion para
  `migrate deploy`.
- `.dockerignore` (los `node_modules` del host, junctions en Windows, rompian
  `tsc` dentro del build y `.env` entraba al contexto).
- `docker-compose.prod.yml` pasaba `JWT_SECRET` y `SMTP_PASSWORD`; el codigo
  lee `JWT_ACCESS_SECRET` y `SMTP_PASS`. CI tenia el mismo error en los dos
  jobs e2e.
- `deploy.sh` respaldaba antes de levantar PostgreSQL (fallaba en el primer
  despliegue). Nombres de proyecto distintos para los compose de desarrollo y
  produccion. CI arranca la imagen construida y consulta `/health`.
- En produccion la API rechaza los secretos de ejemplo y exige `COOKIE_SECURE`.

## [1.0.0] — 2026-09-22

Primera version completa de la plataforma.

### Plataforma

- Monorepo pnpm con `apps/api` (NestJS 10 + Prisma 6 + PostgreSQL 17),
  `apps/web` (React 18 + Vite 6, PWA) y `packages/shared` como contrato comun.
- Multiempresa desde la primera tabla: una extension de Prisma inyecta
  `companyId` en toda lectura y escritura.
- 308 permisos `modulo.recurso.accion` con cuatro alcances de datos
  (`own`, `team`, `area`, `company`) y 11 roles del sistema.
- Auditoria de toda escritura y registro de cada lectura de dato sensible.
- Cifrado AES-256-GCM en columna para salarios, datos bancarios, informacion de
  salud, procesos disciplinarios y denuncias.

### Motores transversales

- Flujos de aprobacion genericos sobre `(entityType, entityId)`, con pasos
  condicionales y bandeja unificada.
- Notificaciones en aplicacion, correo y tiempo real, con preferencias por
  persona.
- Archivos con URL prefirmada; motor local firmado con HMAC y motor S3 con
  SigV4 implementado sin SDK.
- Formularios dinamicos versionados, compartidos por encuestas, evaluaciones e
  inspecciones.
- Editor de bloques versionado, compartido por lecciones, wiki, publicaciones,
  politicas y plantillas de documentos, con saneado y lista blanca de
  dominios embebibles.
- API keys y webhooks firmados con HMAC-SHA256.

### Modulos

Personal, organizacion, seleccion, onboarding, ausencias, tiempo y asistencia,
formacion, desempeno, comunicacion, encuestas, canal de denuncias, documentos y
politicas, servicio al colaborador, seguridad y salud en el trabajo, analitica
y configuracion. 421 endpoints y 75 pantallas.

### Portales publicos

- Portal de empleo con postulacion y adjunto sin sesion.
- Canal de denuncias anonimo con codigo de seguimiento y conversacion con el
  investigador.
- Verificacion publica de documentos por codigo QR.
- Pagina de pre-ingreso para el nuevo colaborador.

### Cumplimiento

- Habeas Data (Ley 1581 de 2012): consentimiento, finalidad declarada, consulta,
  actualizacion, anonimizacion por retencion y trazabilidad.
- Calendario colombiano completo con Ley Emiliani; 15 dias habiles de vacaciones
  por ano con prorrateo.
- Indicadores minimos de la Resolucion 0312 de 2019 y matriz de riesgos.
- Plazos del canal de denuncias segun la Ley 2466 de 2025.

### Pruebas

- 177 pruebas unitarias, 99 e2e de API contra PostgreSQL real y 41 flujos de
  navegador en escritorio y movil.
- Prueba de carga con k6 sobre listados y marcacion.

### Correcciones durante la construccion

Defectos reales encontrados y corregidos antes de la entrega. Se listan porque
explican decisiones del codigo y porque varios solo se ven desde fuera.

- **Los comodines de permisos no expandian.** `people.*` compilaba a un patron
  que no alcanzaba codigos de tres segmentos, y dejaba a `hr_admin` con 27
  permisos efectivos y 403 en casi todo. Hay prueba de regresion.
- **`Button asChild` rompia la pagina.** El componente pasaba el indicador de
  carga junto al hijo y `Slot` de Radix exige exactamente un hijo: cada
  `<Button asChild><Link>` reventaba con pantalla de error.
- **El paquete de produccion no arrancaba.** El troceado manual separaba React
  de las librerias que dependen de el y el trozo de React se evaluaba despues
  (`Cannot read properties of undefined (reading 'useLayoutEffect')`). El
  servidor de desarrollo no lo mostraba.
- **La aprobacion respondia antes de aplicarse.** `@OnEvent(..., { async: true })`
  hace que el emisor despache sin esperar, asi que el aprobador refrescaba la
  bandeja y seguia viendo la solicitud pendiente.
- **`upsert` no quedaba filtrado por empresa.** Su `where` solo admite campos
  unicos, igual que `findUnique`: una clave que coincidiera con una fila de otra
  empresa la habria actualizado. Ahora la fila se resuelve con el filtro de
  empresa y el cruce se rechaza.
- **Las etiquetas no estaban asociadas a sus campos.** Un lector de pantalla no
  anunciaba la etiqueta y pulsar sobre ella no enfocaba el campo. El asterisco
  de obligatorio, ademas, se leia en voz alta.
- **Los limites de tasa sacaban a usuarios legitimos.** 10 ingresos y 30
  refrescos por minuto y por IP bloquean a una oficina entera detras de un solo
  NAT. La proteccion real contra fuerza bruta es el bloqueo por cuenta.
- **Los colores de estado reutilizaban tonos categoricos**, contra la regla de
  que el estado es una codificacion reservada. Se redefinieron con pasos
  propios, validados para claro y oscuro.
- **La matriz de riesgos ignoraba las etiquetas de fila**, asi que el mapa de
  calor se mostraba sin su eje vertical.
- **La empresa de demostracion no era coherente:** la cuenta de colaborador
  apuntaba a una persona retirada, no habia flujo de aprobacion configurado y el
  jefe demo no era jefe de nadie. Sin eso, la bandeja de aprobaciones estaba
  siempre vacia y no habia encuestas que responder.

### Limitaciones conocidas

- El informe del ciclo 360 no se genera como PDF en el servidor.
- El selector de idioma solo traduce el menu, el ingreso y el tablero: el resto
  de las pantallas tiene el texto en espanol dentro del codigo.
- El despliegue esta escrito y probado por partes, pero no se ejecuto de
  principio a fin en una maquina limpia.
