# Criterios de aceptacion

Los diez criterios de la especificacion, con la evidencia de como se verifico
cada uno. Donde un criterio no se cumple del todo, lo dice.

Cifras medidas el 22 de septiembre de 2026 sobre la empresa de demostracion
(125 colaboradores, 6 vacantes, 232 invitaciones a encuestas) con el build de
produccion servido por `vite preview` y PostgreSQL 17 local.

---

## 1. Un usuario de una empresa no puede ver ni inferir datos de otra

**Cumple.** Verificado por prueba automatizada.

El aislamiento no depende de que cada consulta recuerde filtrar: una extension
de Prisma inyecta `companyId` en toda lectura y escritura
([ADR-0001](DECISIONS.md#adr-0001)).

`apps/api/test/e2e/access-control.e2e.spec.ts`:

- un identificador de otra empresa responde 403/404 y el cuerpo no filtra datos;
- todo lo que devuelve un listado pertenece a la empresa de la sesion;
- enviar un `companyId` ajeno al crear un registro no tiene efecto: la fila
  queda en la empresa de quien la crea.

## 2. Ningun endpoint sin permiso; ninguna pantalla muestra modulos no asignados

**Cumple.** Verificado en la API y en el navegador.

Tres compuertas independientes: modulo activo, permiso del rol y alcance de
datos. En la misma suite de control de acceso: un colaborador recibe 403 en
`/ethics/reports`, `/audit/logs`, `/users` y `/users/roles/all`; el oficial de
etica si entra al canal; solo el administrador de empresa lee el catalogo de
permisos.

En el navegador (`apps/web/e2e/auth.spec.ts`): el menu de un colaborador no
tiene Configuracion y el de un administrador si. Escribir `/settings` a mano
devuelve al tablero (`apps/web/e2e/portal.spec.ts`).

## 3. Toda accion de escritura relevante aparece en auditoria con diff

**Cumple.**

`audit_logs` guarda actor, accion, entidad, IP, navegador y el antes y el
despues. Ademas, cada **lectura** de un dato sensible deja fila en
`sensitive_access_logs`, que es donde de verdad ocurre el acceso indebido en una
plataforma de talento humano.

Verificado en `apps/api/test/e2e/approvals.e2e.spec.ts` (la aprobacion queda
registrada contra la instancia del flujo, que apunta a la solicitud, y la
creacion contra la solicitud) y en `hiring.e2e.spec.ts` (la contratacion queda
auditada con su actor).

## 4. Denuncia anonima: imposible vincularla a la persona desde base de datos o logs

**Cumple.** Es la garantia mejor verificada del sistema.

El anonimato es estructural: la tabla `ethics_reports` **no tiene** columnas de
IP, dispositivo ni usuario creador. No es que el codigo evite escribirlas.

`apps/api/test/e2e/ethics.e2e.spec.ts` consulta `information_schema` para
comprobar que esas columnas no existen, y ademas verifica que no hay datos de
contacto, que asunto, descripcion y mensajes se guardan cifrados (`enc:v1:`),
que la clave de seguimiento solo se guarda como hash, y que el envio **no
genera fila de auditoria**. El flujo completo (enviar, recibir codigo,
consultar, conversar) se recorre tambien en el navegador
(`apps/web/e2e/ethics-portal.spec.ts`).

## 5. Solicitud de vacaciones: sin solapamiento, valida saldo, notifica, se aprueba desde bandeja y se refleja en calendario y asistencia

**Cumple.** Verificado de extremo a extremo.

`apps/api/test/e2e/approvals.e2e.spec.ts` recorre el circuito completo: la
solicitud queda pendiente, reserva saldo, aparece en la bandeja del **jefe
directo real** (resuelto desde el organigrama, no una cuenta fija), el
solicitante no puede aprobarse a si mismo, el jefe aprueba, el saldo pasa de
reservado a tomado, la ausencia aparece en el calendario, los dias quedan
marcados en asistencia, se notifica al solicitante y la solicitud desaparece de
la bandeja.

`leaves.e2e.spec.ts` cubre los rechazos: solapamiento (`LEAVE_OVERLAP`), maximo
por solicitud (`LEAVE_MAX_DAYS`), saldo insuficiente (`INSUFFICIENT_BALANCE`) y
fechas invertidas.

En el navegador, `apps/web/e2e/leaves-approval.spec.ts` hace el mismo recorrido
con dos sesiones distintas.

**Un defecto encontrado y corregido aqui:** la aprobacion respondia antes de
aplicarse. El aprobador refrescaba la bandeja y seguia viendo la solicitud
pendiente. Causa: `@OnEvent(..., { async: true })` hace que el emisor despache
sin esperar. Ver [ADR-0011](DECISIONS.md#adr-0011) y `leaves.service.ts`.

## 6. Contratar un candidato crea colaborador, usuario, legajo y onboarding sin intervencion manual

**Cumple.** Verificado por prueba automatizada.

`apps/api/test/e2e/hiring.e2e.spec.ts` publica una vacante propia, se postula
desde el portal publico sin sesion, contrata, y comprueba contra la base de
datos: se crea el colaborador activo en la empresa correcta, su contrato, una
cuenta de usuario ligada con rol `employee` (nunca elevado), el proceso de
onboarding con sus tareas y su enlace de pre-ingreso, que la postulacion queda
como contratada, que el candidato deja de estar sujeto a retencion de datos, y
que todo queda auditado. Contratar dos veces la misma postulacion se rechaza.

## 7. Ciclo 360 completo de extremo a extremo con informe PDF

**Cumple parcialmente.**

El ciclo 360 esta implementado: plantillas de evaluacion, ciclos, asignaciones
por tipo de evaluador (autoevaluacion, jefe, pares, reportes), respuestas,
calibracion y matriz nine-box. La interfaz permite recorrerlo.

**Lo que falta:** no hay informe en PDF generado en el servidor. La plataforma
produce HTML listo para imprimir y deja que el navegador genere el PDF, con una
costura (`PdfRenderer`) preparada para conectar un renderizador headless
([ADR-0006](DECISIONS.md#adr-0006)). Para los documentos con validez (cartas,
certificados) eso basta, porque lo que da validez es el codigo de verificacion
publica; para un informe 360 es una limitacion real que conviene resolver antes
de un despliegue donde se exija el PDF firmado.

El ciclo 360 tampoco tiene prueba de extremo a extremo automatizada, a
diferencia de ausencias, contratacion y denuncias.

## 8. El tablero ejecutivo carga en menos de 2 s con la empresa demo

**Cumple.** Medido sobre el build de produccion.

| Pantalla | Carga completa | Primer pintado |
|---|---|---|
| Tablero ejecutivo (administrador) | **1743 ms** | 60 ms |
| Analitica (talento humano) | 1082 ms | 76 ms |
| Portal del colaborador | 741 ms | 48 ms |
| Nomina de personal | 662 ms | 48 ms |

El tiempo incluye la navegacion completa hasta que la red queda en reposo, es
decir, con todas las consultas del tablero resueltas. El margen es de 257 ms:
no es holgado, y si la empresa crece conviene apoyarse en los snapshots diarios
(`POST /analytics/snapshots/run`) en vez de recalcular en cada visita.

**Un defecto encontrado al medir:** el paquete de produccion no arrancaba
(`Cannot read properties of undefined (reading 'useLayoutEffect')`). El
troceado manual separaba React de las librerias que dependen de el y el trozo
de React se evaluaba despues. El servidor de desarrollo no lo mostraba. Se
quito el troceado manual: el peso ya se controla por ruta con `React.lazy`.

## 9. Portal del empleado usable en movil (Lighthouse PWA >= 90)

**Cumple en lo verificable; el numero de Lighthouse no se ejecuto.**

Se comprobaron, sobre el build de produccion, los requisitos que Lighthouse
evalua para una aplicacion instalable:

| Requisito | Estado |
|---|---|
| Manifiesto servido y valido | si |
| `name` y `short_name` | TALENTO - Gestion de Talento Humano / TALENTO |
| `start_url` | `/portal` |
| `display: standalone` | si |
| `theme_color` | `#2563eb` |
| Iconos 192, 512 y 512 maskable | si |
| Service worker registrado | si |
| `viewport` con `viewport-fit=cover` | si |
| `lang` del documento | `es` |

Ademas, el portal se prueba en un proyecto de Playwright que emula un Pixel 7:
el menu movil abre y la pagina **no desborda horizontalmente**
(`apps/web/e2e/portal.spec.ts`).

**Lo que no se hizo:** ejecutar Lighthouse y obtener la cifra. Los requisitos
estan, pero la puntuacion concreta esta sin medir.

## 10. Despliegue reproducible en una maquina limpia con un solo script y `.env`

**Cumple en la definicion; no se verifico en una EC2 limpia.**

`infra/scripts/deploy.sh` respalda, construye, migra, levanta y verifica el
health check, y aborta si la API no responde. `infra/docker-compose.prod.yml`
define la pila completa con la base de datos y la cache fuera de la red de
borde, nginx con TLS y renovacion automatica del certificado.
`infra/scripts/backup.sh` y `restore.sh` cubren el ciclo de respaldo, con sumas
de verificacion y copia fuera del servidor.

**Lo que si se hizo el 23 de septiembre:** construir las dos imagenes desde
un checkout limpio, arrancar la de la API contra PostgreSQL y consultar
`/health`, arrancar la web y comprobar el fallback de la SPA, validar los dos
compose, renderizar la plantilla de nginx con el script real de la imagen y
pasarla por `nginx -t`. Esa verificacion encontro cuatro bloqueantes (la
imagen no arrancaba por `zod`, faltaba `.dockerignore`, el respaldo corria con
la base apagada y CI pasaba `JWT_SECRET` en vez de `JWT_ACCESS_SECRET`); estan
corregidos y CI ahora arranca la imagen construida.

**Lo que no se hizo:** ejecutar el despliegue en una instancia EC2 nueva de
principio a fin.

---

## Requisitos de calidad (seccion 11 de la especificacion)

| Requisito | Estado |
|---|---|
| Lint y typecheck en pre-commit | Cumple: husky + lint-staged |
| Cobertura >= 80% en logica critica | Cumple: 98.6% en `@talento/shared`, 100% en el cifrado ([ADR-0010](DECISIONS.md#adr-0010)) |
| e2e de API por modulo con permisos y aislamiento | Cumple: 106 pruebas en 7 suites |
| Playwright: ingreso, vacaciones, postulacion, marcacion, encuesta, denuncia | Cumple: 47 pruebas, escritorio y movil |
| Prueba de carga basica con k6 | Cumple: `infra/load/` |

## Resumen de pruebas

| Nivel | Cantidad | Estado |
|---|---|---|
| Unitarias | 182 | pasan |
| e2e de API | 106 | pasan |
| Navegador | 47 | pasan |

## Internacionalizacion: la interfaz esta en espanol, el i18n no la cubre entera

La especificacion pide interfaz en espanol a traves de i18n. Conviene separar
las dos mitades de ese requisito, porque solo una esta completa.

**En espanol: si.** Toda la interfaz visible esta en espanol. Una revision de
las 78 paginas no encontro texto en ingles de cara al usuario. Los tres
diccionarios (`es`, `en`, `de`) tienen exactamente las mismas 80 claves, sin
huecos en ninguna direccion.

**A traves de i18n: parcialmente.** Solo 8 de los 78 archivos de pantalla usan
`useT()`. Las claves cubren el menu, el ingreso, el tablero y el portal; el
resto de las paginas llevan los textos en espanol escritos directamente en el
JSX. Hay ademas un catalogo de etiquetas de estado en `apps/web/src/lib/utils.ts`
(`STATUS_LABELS`) que vive fuera del sistema de traduccion.

**Consecuencia concreta:** el selector de idioma funciona, pero al elegir
`English` o `Deutsch` solo cambian el menu lateral, el ingreso y el tablero. El
resto sigue en espanol. Para una empresa colombiana eso no estorba; para vender
la plataforma fuera, extraer los textos de las ~70 paginas restantes es trabajo
pendiente y conocido, no un descuido.

## Cobertura de la seccion 5 de la especificacion

Una auditoria funcionalidad por funcionalidad (121 lineas de la seccion 5)
dio: 42 implementadas, 70 parciales, 6 ausentes y 3 declaradas fuera de
alcance por la propia especificacion (SCORM, chat interno, conectores de
correo y WhatsApp). El patron de los parciales es el mismo casi siempre: el
modelo y la API existen, la pantalla no. Tras esta revision quedaron
implementados el planificador, las API keys, los reintentos de webhooks, el
tiempo real en el cliente, la importacion desde Excel, el envio de ofertas y
correos por etapa, el pre-ingreso con carga de documentos y el escalamiento de
tareas y aprobaciones. `PLAN.md` lista lo que sigue abierto por modulo.

## Lo que queda abierto

1. **Informe 360 en PDF** generado en el servidor (criterio 7).
2. **Puntuacion de Lighthouse** medida, no solo los requisitos (criterio 9).
3. **Despliegue ejecutado en una EC2 limpia** de principio a fin (criterio 10).
4. **Prueba e2e del ciclo 360**, que hoy no tiene cobertura automatizada.
5. **Extraccion de textos a i18n** en las paginas que aun no lo usan.
6. **Pantallas para funciones que ya tienen API** (ver `PLAN.md`): turnos
   con asignacion, procesos disciplinarios, flujos de aprobacion y plantillas
   de notificacion, 1:1, PDI, carrera y sucesion, eventos, tablero del jefe,
   preferencias de notificacion, ficha 360 completa.
7. **Push PWA, SSO OIDC, H5P/xAPI, HLS** y la programacion de reportes desde
   la interfaz: sin implementar.
