# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
