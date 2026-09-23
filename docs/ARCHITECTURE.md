# Arquitectura

## El problema que resuelve la forma del sistema

Una plataforma de talento humano guarda, en la misma base de datos, el
organigrama que todos pueden ver y la denuncia anonima que casi nadie puede
ver. La arquitectura esta organizada alrededor de esa tension: **cada dato tiene
un alcance, y el alcance se aplica en el servidor, no en la pantalla**.

De ahi salen las tres decisiones que estructuran todo lo demas:

1. **Multiempresa desde la primera tabla.** Añadir aislamiento despues obliga a
   revisar cada consulta; hacerlo desde el inicio lo convierte en una propiedad
   del cliente de base de datos.
2. **Permisos como dato, no como codigo.** Un `if (user.role === 'admin')`
   repartido por el codigo es imposible de auditar. El catalogo de permisos es
   una estructura consultable y los guards la aplican de forma uniforme.
3. **Lo sensible se cifra en la columna.** Si un respaldo se filtra, los
   salarios, los datos de salud y las denuncias siguen siendo ilegibles.

## Mapa

```
                    navegador / PWA
                          |
                     nginx (una sola origen)
                    /                    \
          /api/*  -> NestJS            /* -> SPA estatica
                       |
       +---------------+----------------+
       |               |                |
  PostgreSQL 17     Redis (colas)   Almacenamiento
  (211 tablas)      opcional        (local o S3)
```

El navegador habla con **un solo origen**: nginx enruta `/api` a la API y el
resto a la aplicacion. Asi la cookie de refresco es de primera parte y no hay
CORS en produccion.

## Monorepo

```
packages/shared     El contrato. Permisos, roles, catalogo de modulos,
                    esquemas Zod y utilidades de dominio (calendario
                    colombiano, causacion de vacaciones). Lo consumen la API
                    y la web, de modo que una regla existe una sola vez.

apps/api            NestJS. `core/` son las capacidades transversales
                    (autenticacion, permisos, auditoria, archivos, flujos de
                    aprobacion, notificaciones, formularios, integraciones);
                    `modules/` son los dominios funcionales.

apps/web            React. Una carpeta por modulo en `features/`, componentes
                    compartidos en `components/`, y el enrutador que decide
                    que ve cada rol.
```

Que los permisos vivan en `packages/shared` no es un detalle de organizacion:
es lo que permite que el menu lateral, el enrutador y los guards del servidor
partan de la misma lista y no se desincronicen.

## Multiempresa

`PrismaService.forCompany(companyId)` devuelve un cliente extendido que inyecta
`companyId` en cada lectura y escritura:

```ts
const db = this.prisma.forCompany(ctx.companyId);
await db.employee.findMany();   // ... WHERE company_id = $1
await db.employee.create({ data }); // company_id se agrega solo
```

La extension recorre el modelo de datos en tiempo de arranque y solo actua sobre
las tablas que tienen la columna. Las tablas de catalogo con `companyId`
opcional siguen mostrando las filas globales (`companyId IS NULL`).

**Una regla importa mas que las demas:** `findUnique` no admite condiciones
extra, asi que **no queda filtrado**. Los servicios usan `findFirst`. La razon
esta en [ADR-0002](DECISIONS.md#adr-0002).

## Permisos

Un permiso es `modulo.recurso.accion` y se otorga con un **alcance de datos**:

| Alcance | Alcanza |
|---|---|
| `own` | Solo sus propios registros |
| `team` | Su equipo directo, resuelto por la cadena de jefatura |
| `area` | Su area y las areas que dependen de ella |
| `company` | Toda la empresa |

`ScopeService` resuelve `team` y `area` con consultas recursivas sobre la
jerarquia, no con listas en memoria: un cambio de organigrama surte efecto sin
reiniciar nada.

El acceso se decide en tres capas y **las tres tienen que dejar pasar**:

1. `@RequireModule(...)` — la empresa tiene el modulo activo.
2. `@RequirePermission(...)` — el rol tiene el permiso.
3. Alcance — la fila pedida cae dentro del alcance del permiso.

Los roles del sistema se definen con patrones (`people.*`) que se expanden
contra el catalogo al sembrar. Un comodin mal compilado deja a un rol sin
permisos efectivos, asi que esa expansion tiene pruebas dedicadas.

## Datos sensibles

| Que | Como |
|---|---|
| Salario, datos bancarios, salud, disciplinarios, denuncias | AES-256-GCM en la columna, prefijo `enc:v1:` |
| Claves de seguimiento de denuncias | Hash SHA-256, nunca el valor |
| Contrasenas | Argon2id |
| Lectura de datos sensibles | Fila en `sensitive_access_logs` |
| Cualquier cambio | Fila en `audit_logs` con el antes y el despues |

El cifrado ocurre en la aplicacion, no en la base de datos: los valores viajan
opacos a replicas y respaldos. Detalles en [ADR-0003](DECISIONS.md#adr-0003).

**El canal de denuncias es un caso aparte.** La tabla `ethics_reports` no tiene
columnas de IP, dispositivo ni usuario creador: el anonimato no depende de que
el codigo se acuerde de no escribirlos, sino de que no exista donde escribirlos.

## Motores transversales

Seis capacidades se implementaron una vez y las usan todos los modulos:

- **Flujos de aprobacion.** Generico sobre `(entityType, entityId)`. Un modulo
  que necesita aprobacion no escribe logica de aprobacion. Sin flujo configurado
  la solicitud se aprueba sola, de modo que todo funciona desde el primer dia y
  gana aprobaciones cuando la empresa las configura.
- **Notificaciones.** Un evento de dominio produce notificacion en la aplicacion,
  correo y evento en tiempo real, segun las preferencias de cada persona.
- **Archivos.** URL prefirmada, confirmacion y descarga firmada. Dos motores:
  local (firmado con HMAC) y S3 (SigV4 implementado a mano, sin SDK).
- **Formularios dinamicos.** Un esquema JSON versionado que se usa en encuestas,
  evaluaciones, listas de chequeo e inspecciones.
- **Editor de bloques.** Un documento de bloques versionado que comparten
  lecciones, wiki, publicaciones, politicas y plantillas de documentos. Nunca se
  guarda HTML crudo: se sanea al renderizar y los embebidos pasan por una lista
  blanca de dominios.
- **Integraciones.** API keys y webhooks firmados con HMAC-SHA256.

## Frontend

El menu lateral no esta escrito a mano: se arma con la interseccion entre el
catalogo de modulos y los modulos que el usuario tiene. El enrutador aplica la
misma regla, asi que una ruta escrita a mano en la barra de direcciones no abre
un modulo que el rol no tiene.

Las paginas se cargan con `React.lazy`, y el empaquetado separa React, Recharts,
Radix y el editor en trozos propios: la primera carga del portal no descarga el
codigo de las graficas.

### Graficas

La paleta se valido para deficiencia de vision de color **antes** de escribir la
primera grafica, con el validador de la metodologia. Las reglas que se aplican:

- Los tonos categoricos se asignan en orden fijo y **nunca se ciclan**: a partir
  del noveno, la cola se pliega en "Otros".
- Nunca dos ejes verticales en una grafica.
- Magnitud con rampa de un solo tono; los colores de estado son reservados y
  jamas se reutilizan como "serie 4".
- Con dos o mas series siempre hay leyenda, y ademas etiquetas directas.

Ver [ADR-0007](DECISIONS.md#adr-0007).

## Colas

Con `REDIS_ENABLED=false` los trabajos se ejecutan en linea: una instalacion
pequena no necesita Redis para funcionar. Con Redis activo, los mismos trabajos
pasan a BullMQ sin cambiar el codigo que los encola ([ADR-0005](DECISIONS.md#adr-0005)).

## Que hay fuera del alcance, a proposito

- Nomina, liquidaciones, seguridad social y contabilidad.
- Firma digital certificada. Hay firma simple con sello de tiempo y acuse.
- Reconocimiento biometrico. La marcacion usa geocerco y dispositivo.
