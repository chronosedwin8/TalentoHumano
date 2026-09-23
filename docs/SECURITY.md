# Seguridad y proteccion de datos

## Acceso

Cada peticion pasa por tres compuertas y **las tres tienen que dejar pasar**:

```
@RequireModule('people')          la empresa tiene el modulo activo
@RequirePermission('people.employee.read')   el rol tiene el permiso
alcance de datos                  la fila pedida cae dentro del alcance
```

Un permiso es `modulo.recurso.accion` y se otorga con alcance:

| Alcance | Alcanza | Se resuelve |
|---|---|---|
| `own` | Sus propios registros | `employeeId` de la sesion |
| `team` | Su equipo directo | Cadena de jefatura, consulta recursiva |
| `area` | Su area y las dependientes | Jerarquia de areas, consulta recursiva |
| `company` | Toda la empresa | `companyId` de la sesion |

Hay 308 permisos y 11 roles del sistema. Los roles se definen con patrones
(`people.*`) que se expanden contra el catalogo al sembrar.

**Una advertencia que costo un error real:** un comodin mal compilado no falla,
deja al rol sin permisos efectivos y todo responde 403. `people.*` tiene que
alcanzar `people.employee.read`, que tiene tres segmentos. Hay pruebas dedicadas
a esa expansion.

## Sesiones

| | |
|---|---|
| Token de acceso | JWT de 15 minutos, en memoria del navegador |
| Token de refresco | 30 dias, cookie `httpOnly` `sameSite=lax`, **rotatorio y de un solo uso** |
| Contrasenas | Argon2id |
| Segundo factor | TOTP opcional, con codigos de recuperacion |
| Bloqueo de cuenta | Tras `LOCKOUT_ATTEMPTS` intentos, por `LOCKOUT_MINUTES` |

El token de acceso no se guarda en `localStorage`: vive en memoria y se renueva
en cada carga de pagina con la cookie de refresco. Un XSS no puede leerlo desde
el almacenamiento porque no esta ahi.

La proteccion contra fuerza bruta es **por cuenta**, no por IP: una oficina
entera comparte direccion publica ([ADR-0009](DECISIONS.md#adr-0009)).

## Datos sensibles

### Que se cifra

| Dato | Tabla |
|---|---|
| Salario y rangos salariales | `employee_contracts`, `positions`, `job_postings` |
| Datos bancarios | `employee_bank_accounts` |
| Informacion de salud y examenes | `employee_health`, `medical_exams` |
| Procesos disciplinarios | `disciplinary_processes` |
| Denuncias y sus mensajes | `ethics_reports`, `ethics_report_messages` |

AES-256-GCM en la capa de aplicacion, prefijo `enc:v1:`, nonce distinto por
valor. Detalles y consecuencias en [ADR-0003](DECISIONS.md#adr-0003).

### Que se registra

| Registro | Que guarda |
|---|---|
| `audit_logs` | Quien, que, cuando, desde donde, con el antes y el despues |
| `sensitive_access_logs` | Cada **lectura** de un dato sensible |

Leer un salario deja huella. Eso es intencional: en una plataforma de talento
humano, el acceso indebido casi siempre es una lectura, no una escritura.

## Canal de denuncias

Es la superficie mas delicada del sistema y tiene garantias propias.

**El anonimato es estructural, no una promesa del codigo.** La tabla
`ethics_reports` **no tiene columnas** de IP, dispositivo ni usuario creador.
No es que el codigo evite escribirlas: no existen donde escribirlas.

| Garantia | Como se sostiene |
|---|---|
| Sin IP ni dispositivo | La tabla no tiene esas columnas |
| Sin rastro en auditoria | El envio no genera fila en `audit_logs` |
| Contenido ilegible en la base | Asunto, descripcion y mensajes cifrados |
| Clave de seguimiento | Se guarda solo el hash SHA-256 |
| Solo el oficial de etica lee | Permiso `ethics.report.read`, marcado sensible |
| El implicado no ve su caso | Exclusion explicita por `excludedUserIds` |
| Cada lectura queda registrada | `sensitive_access_logs` |

El denunciante recibe un codigo y una clave. Con ambos consulta el estado y
conversa con el investigador sin identificarse. **Sin los dos datos, nadie —ni la
empresa— puede vincular la denuncia con una persona.**

Una prueba e2e verifica cada punto de esa tabla contra la base de datos real,
incluida la ausencia de columnas.

## Portales publicos

Sin sesion, limitados por tasa:

| Portal | Limite |
|---|---|
| `GET /public/careers/:slug` | 60/min |
| `POST .../apply` | 10/hora |
| `GET /public/ethics/:slug` | 60/min |
| `POST /public/ethics/:slug/reports` | 20/hora (`ETHICS_REPORT_LIMIT`) |
| `POST /public/ethics/follow-up` | 20/hora |
| `POST /public/:slug/uploads` | 10/hora |

Los adjuntos publicos aceptan solo PDF, Word e imagen, hasta 10 MB
([ADR-0008](DECISIONS.md#adr-0008)).

**Por que el canal de denuncias no lleva un limite estrecho.** Una oficina
entera comparte una sola direccion publica. Con cinco denuncias por hora, la
sexta persona que quisiera reportar algo el mismo dia quedaria bloqueada sin
saber por que. El limite esta para frenar inundaciones, no para racionar un
canal de denuncias, y es ajustable (`ETHICS_REPORT_LIMIT`). Lo mismo aplica al
ingreso (`AUTH_LOGIN_LIMIT`) y a la rotacion de sesion (`AUTH_REFRESH_LIMIT`):
ver [ADR-0009](DECISIONS.md#adr-0009).

## Contenido

El editor de bloques nunca guarda HTML crudo: guarda un documento de bloques
versionado. Al renderizar:

- El texto enriquecido pasa por DOMPurify con una lista corta de etiquetas y
  atributos permitidos.
- Los embebidos pasan por una **lista blanca de dominios**, comparada por host
  exacto o subdominio. `youtube.com.atacante.net` no pasa, y hay pruebas que lo
  verifican.
- Los iframes van con `sandbox`.

## Habeas Data (Ley 1581 de 2012)

| Obligacion | Implementacion |
|---|---|
| Consentimiento informado | Casilla obligatoria en cada portal publico, con la politica de la empresa |
| Finalidad | Cada portal declara para que se usan los datos |
| Consulta y actualizacion | El colaborador ve y corrige su ficha desde el portal |
| Supresion | Anonimizacion de candidatos no seleccionados tras el plazo configurado |
| Trazabilidad | `audit_logs` y `sensitive_access_logs` |

La retencion de candidatos se ejecuta con `POST /recruiting/retention/anonymize`,
que reemplaza los datos identificables conservando las estadisticas agregadas.

## Cabeceras y transporte

nginx agrega HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` y `Permissions-Policy`. La API usa `helmet`. En produccion
todo va por TLS 1.2+ y el HTTP plano solo sirve el desafio ACME.

## Secretos

| Variable | Si se pierde |
|---|---|
| `ENCRYPTION_KEY` | **Los datos cifrados quedan ilegibles para siempre** |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Todas las sesiones se invalidan |
| `COOKIE_SECRET` | Las cookies firmadas se invalidan |

`ENCRYPTION_KEY` se guarda **separada de los respaldos**. El script de respaldo
no la incluye a proposito.

## Reportar una vulnerabilidad

Escribir a la persona responsable del proyecto con pasos de reproduccion. No
abrir un issue publico.
