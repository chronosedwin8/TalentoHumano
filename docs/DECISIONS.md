# Decisiones tecnicas

Cada decision registra el problema, lo que se eligio, lo que se descarto y lo
que costo. Las que estan marcadas como desviaciones se apartan de lo que pedia
la especificacion original y explican por que.

---

## ADR-0001 · Aislamiento multiempresa en el cliente de base de datos

**Problema.** Con 211 tablas y 421 endpoints, confiar en que cada consulta
recuerde filtrar por empresa garantiza que alguna no lo haga. Una consulta
olvidada no falla: devuelve datos de otra empresa.

**Decision.** Una extension de Prisma (`PrismaService.forCompany`) inyecta
`companyId` en toda lectura y escritura. Los servicios piden un cliente ya
delimitado y no vuelven a pensar en el tema.

**Alternativas descartadas.**

- *Row Level Security de PostgreSQL.* Mas fuerte, porque actua aunque alguien
  entre por `psql`. Se descarto porque exige una variable de sesion por
  conexion, y con un pool eso es facil de romper; ademas complica migraciones y
  semillas. Sigue siendo el camino natural si aparece un requisito de
  aislamiento certificable.
- *Repositorio base con el filtro.* Solo protege a quien lo use.

**Costo.** Los tipos de `create` quedan laxos, porque `companyId` se agrega en
tiempo de ejecucion y TypeScript no lo sabe. Se acoto con un tipo mapeado que
afloja solo las operaciones de escritura y conserva el tipado de lecturas,
`include` y `select`.

---

## ADR-0002 · `findFirst` en lugar de `findUnique`

**Problema.** `findUnique` de Prisma solo acepta campos unicos en el `where`, de
modo que **la extension de tenencia no puede agregarle el filtro de empresa**.
Un `findUnique({ where: { id } })` devuelve la fila aunque sea de otra empresa.

**Decision.** Los servicios usan `findFirst({ where: { id, ... } })`. Es la
regla menos intuitiva del codigo y la que mas facil se rompe, por eso esta
documentada aqui y verificada con una prueba e2e que pide un identificador
ajeno y espera 403/404.

**Costo.** `findFirst` no usa la ruta optimizada de clave primaria. En la
practica es irrelevante: el indice sigue siendo el mismo.

**El mismo agujero en otra operacion.** Una auditoria posterior encontro que
`upsert` tiene exactamente el mismo problema, y no estaba cubierto por la regla:
su `where` tambien exige campos unicos, asi que la extension tampoco podia
filtrarlo. Habia 31 llamadas en el codigo. Las revisadas estaban defendidas por
una validacion de alcance previa, pero la garantia estructural no existia.

Se cerro en la propia extension: ante un `upsert`, la fila se resuelve primero
con el filtro de empresa aplicado. Si existe en esta empresa se actualiza por
id; si existe en otra, la escritura se rechaza con `TENANT_MISMATCH` en vez de
cruzar la frontera en silencio; si no existe, el create sigue su curso.

---

## ADR-0003 · Cifrado en la aplicacion, no en la base de datos

**Problema.** Salarios, datos bancarios, informacion de salud, procesos
disciplinarios y denuncias no pueden quedar legibles en un respaldo, una replica
de lectura o un volcado de soporte.

**Decision.** AES-256-GCM en la capa de aplicacion, con prefijo `enc:v1:` que
identifica la version del esquema. Las columnas siguen siendo texto, asi que
Prisma no necesita saber nada.

**Alternativas descartadas.**

- *`pgcrypto` en la base de datos.* Obliga a pasar la llave en cada consulta,
  con lo que la llave termina en los logs de PostgreSQL.
- *Cifrado de disco.* Protege contra el robo del disco, no contra un volcado.

**Consecuencias que hay que tener presentes.**

- Un campo cifrado **no se puede buscar ni ordenar** en SQL. Donde hace falta
  buscar (nombres, correos) el dato no es sensible y no se cifra.
- GCM autentica: un valor alterado devuelve `null`, no basura.
- Cada cifrado usa un nonce nuevo, de modo que dos personas con el mismo salario
  no tienen el mismo texto cifrado.
- **Perder `ENCRYPTION_KEY` es perder los datos.** Por eso el script de respaldo
  no la incluye: un respaldo que lleva el texto cifrado y su llave no protege
  nada.

---

## ADR-0004 · Indices y restricciones escritos a mano

**Problema.** Prisma no expresa indices GIN con `pg_trgm` ni restricciones
`EXCLUDE`, y ambos hacen falta: busqueda tolerante a errores de escritura y
acentos, e imposibilidad de que una persona tenga dos ausencias aprobadas que se
crucen.

**Decision.** Una migracion escrita a mano agrega:

- Indices GIN con `gin_trgm_ops` sobre nombres de colaborador y candidato.
- `EXCLUDE USING gist` sobre `leave_requests`, que impide en la base de datos
  que dos ausencias aprobadas de la misma persona se solapen.

**Por que la restriccion y no solo la validacion.** El servicio ya valida el
solapamiento, pero dos solicitudes simultaneas pueden pasar ambas la validacion
antes de que cualquiera escriba. La restriccion cierra esa ventana.

---

## ADR-0005 · Cola opcional

**Problema.** Exigir Redis para instalar la plataforma es una barrera grande
para una empresa pequena, pero una empresa grande lo necesita.

**Decision.** `QueueService` expone una interfaz unica. Con `REDIS_ENABLED=false`
ejecuta el trabajo en linea; con Redis, lo encola en BullMQ. El codigo que
encola no cambia.

**Costo.** En modo en linea, una tarea lenta alarga la peticion que la disparo.
Por eso los trabajos realmente pesados (recalculos masivos, exportaciones
grandes) se exponen como endpoints explicitos que el usuario dispara y no como
efectos secundarios de una operacion corriente.

---

## ADR-0006 · HTML listo para imprimir en lugar de PDF generado en el servidor

**Problema.** Generar PDF en el servidor implica Chromium (unos 300 MB en la
imagen) o una libreria con tipografia y acentos limitados.

**Decision.** El documento se genera como HTML con estilos de impresion y codigo
QR embebido; el navegador produce el PDF. `DocumentsService` deja la costura
lista (`PdfRenderer`) para conectar un renderizador cuando haga falta.

**Que se pierde.** No hay PDF adjunto en un correo automatico. El correo lleva
el enlace al documento, que ademas es verificable por su codigo.

**Por que se acepta.** El documento firmado y verificable es el mismo: lo que
da validez es el codigo de verificacion publica, no el formato del archivo.

---

## ADR-0007 · Paleta de graficas validada antes de escribir graficas

**Problema.** Una paleta elegida por gusto suele tener dos tonos que una persona
con deficiencia de vision de color no distingue. Si ademas los tonos se ciclan,
dos categorias distintas terminan del mismo color.

**Decision.** Se definio la paleta y se valido con el script de la metodologia
(banda de luminosidad, piso de croma, separacion entre pares adyacentes con
simulacion de protanopia, deuteranopia y tritanopia, y contraste contra la
superficie) **antes** de escribir la primera grafica. Modo claro y oscuro se
validaron por separado: el oscuro no es una inversion automatica del claro.

Reglas que se aplican en el codigo:

- Orden fijo de tonos, **nunca ciclado**. `foldCategories` pliega la cola en
  "Otros" antes de quedarse sin tonos.
- Un solo eje vertical por grafica.
- Magnitud con rampa de un solo tono.
- Los colores de estado son reservados: no aparecen en el orden categorico y
  siempre van con icono o etiqueta, nunca color solo.

**Advertencia asumida.** Tres tonos categoricos quedan por debajo de 3:1 de
contraste contra la superficie clara. La metodologia lo permite si hay alivio
visible: por eso las graficas llevan etiquetas directas o tabla de apoyo
(`SeriesTable`).

**Correccion registrada.** La primera version reutilizaba tonos categoricos como
colores de estado, lo que viola la regla de reserva. Se corrigio con pasos
propios, validados aparte para claro y oscuro. Una prueba unitaria lo impide en
adelante.

---

## ADR-0008 · Adjuntos publicos con lista blanca propia

**Problema.** Los portales publicos (empleo y denuncias) necesitan recibir
archivos de personas sin sesion, pero `POST /files/presign` exige sesion.

**Decision.** Dos endpoints publicos, limitados por tasa, que reutilizan
`FilesService` con una lista de tipos MIME mas estrecha que la interna (PDF,
Word e imagen) y un limite de 10 MB. El archivo pertenece a la empresa destino
desde su creacion.

**Por que no reutilizar el endpoint interno.** Habria significado abrir toda la
lista de tipos internos al publico, incluidos ejecutables por extension y
archivos grandes.

---

## ADR-0009 · Limites de tasa dimensionados para una oficina detras de un NAT

**Problema.** Los limites iniciales (10 ingresos y 30 refrescos por minuto por
IP) parecen prudentes, pero una oficina entera comparte una sola direccion
publica. Un lunes a las 8 de la manana, el limite bloquea a gente legitima.

**Decision.** Ingreso a 60/min y refresco a 120/min por IP, ambos ajustables
por entorno (`AUTH_LOGIN_LIMIT`, `AUTH_REFRESH_LIMIT`). La proteccion real
contra fuerza bruta es **por cuenta** (`failedLoginAttempts` y `lockedUntil`),
que no depende de la IP; el limite por IP solo amortigua trafico.

El canal de denuncias tenia el mismo problema y es mas grave: con cinco
denuncias por hora y por IP, la sexta persona de una oficina que quisiera
reportar algo el mismo dia quedaba bloqueada. Subio a 20 por hora, tambien
ajustable (`ETHICS_REPORT_LIMIT`).

**Como se encontro.** Los flujos de navegador empezaron a fallar con tiempos de
espera agotados al iniciar sesion, y mas tarde la prueba del canal de denuncias
dejo de pasar al repetir la suite. En ninguno de los dos casos el problema era
la prueba: eran limites que habrian sacado usuarios reales de la plataforma, y
en el segundo caso habrian silenciado una denuncia.

---

## ADR-0010 · Cobertura donde protege, comportamiento donde importa

**Problema.** Exigir 80% de cobertura sobre todo el codigo incentiva pruebas que
recorren servicios simulando la base de datos, que pasan aunque el SQL este mal.

**Decision.** Dos regimenes:

- **Cobertura con umbral (80%)** sobre lo que es logica pura y no puede
  regresar en silencio: catalogo de permisos y comodines, roles, calendario
  colombiano y causacion de vacaciones, y el cifrado de columnas. Hoy esta en
  98% de lineas en `shared` y 100% en el servicio de cifrado.
- **Pruebas de comportamiento** para todo lo que toca la base de datos: 76
  pruebas e2e contra un PostgreSQL real que afirman codigos de respuesta y
  ademas las filas que quedan guardadas, y 34 flujos de navegador.

**Por que asi.** Las afirmaciones que de verdad importan —que una denuncia
anonima no guarda IP, que el contenido queda cifrado, que un colaborador recibe
403— solo se pueden comprobar contra la base de datos real.

---

## ADR-0011 · Extraer reglas puras para poder probarlas

**Problema.** La causacion de vacaciones y la evaluacion de condiciones de un
paso de aprobacion vivian dentro de servicios que necesitan base de datos. Son
las reglas de negocio mas delicadas y eran las menos probables.

**Decision.** Se extrajeron como funciones puras exportadas
(`accrueVacationDays`, `availableLeaveDays`, `matchesStepCondition`) y los
servicios las invocan. La regla se prueba sin base de datos y **el codigo que se
prueba es el que se ejecuta**.

**Por que no probar el servicio con dobles.** Un doble de Prisma prueba el doble.
