# Canal de etica

Recibe denuncias de conducta indebida, por dentro o por fuera de la empresa, y
las lleva hasta un caso cerrado con conclusiones. Lo usa cualquier persona para
denunciar de forma anonima desde un portal publico, y el oficial de etica para
investigar. Es el modulo con el acceso mas restringido de la plataforma: el
contenido va cifrado y cada lectura queda registrada.

## Que hace

- Publica un portal externo, sin sesion, con las categorias del canal de la empresa.
- Recibe denuncias anonimas o identificadas y devuelve un codigo de seguimiento y una clave de acceso.
- Fija el plazo de atencion de la denuncia segun el plazo legal de su categoria.
- Mantiene un buzon de dos vias entre denunciante e investigador que no revela la identidad de ninguno.
- Abre el caso de investigacion, con lider, plan y lista de usuarios excluidos por conflicto de interes.
- Registra acciones del plan de investigacion y evidencias.
- Cierra el caso con conclusiones y medidas, o lo desestima.
- Guarda un registro de acceso propio, separado del general.
- Calcula estadisticas agregadas: volumen, tasa de anonimato, dias promedio de cierre y distribucion por categoria, estado y gravedad.

## Permisos

| Permiso | Para que |
|---|---|
| `ethics.report.read` | Ver las denuncias recibidas y las categorias; cada lectura queda trazada |
| `ethics.report.triage` | Clasificar una denuncia recibida |
| `ethics.case.read` | Ver el registro de accesos a los casos |
| `ethics.case.create` | Abrir el caso de investigacion |
| `ethics.case.update` | Responder al denunciante y registrar acciones del plan |
| `ethics.case.close` | Cerrar el caso con conclusiones y medidas |
| `ethics.evidence.read`, `ethics.evidence.create` | Consultar y aportar evidencias |
| `ethics.stats.read` | Ver estadisticas agregadas, nunca el detalle |
| `ethics.category.manage` | Crear categorias del canal con su plazo legal |

Los permisos de denuncia, caso y evidencia estan marcados como sensibles en el
catalogo: leer a traves de ellos se registra.

## Endpoints

### Portal publico, sin sesion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/public/ethics/:companySlug` | Empresa y categorias activas del canal |
| POST | `/public/ethics/:companySlug/reports` | Envia la denuncia y devuelve codigo y clave |
| POST | `/public/ethics/follow-up` | Consulta estado y conversacion con codigo y clave |
| POST | `/public/ethics/messages` | Envia un mensaje al investigador |

### Oficial de etica

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/ethics/reports` | Denuncias recibidas, con acceso trazado |
| GET | `/ethics/reports/:id` | Detalle de la denuncia y su caso, descifrado |
| POST | `/ethics/reports/:id/case` | Abre el caso de investigacion |
| POST | `/ethics/reports/:id/reply` | Responde al denunciante por el buzon anonimo |
| POST | `/ethics/cases/:id/actions` | Registra una accion del plan |
| POST | `/ethics/cases/:id/close` | Cierra o desestima el caso |
| GET | `/ethics/statistics` | Estadisticas agregadas |
| GET | `/ethics/categories` | Categorias del canal |
| POST | `/ethics/categories` | Crea una categoria con su plazo |
| GET | `/ethics/access-log` | Registro de accesos a los casos |

## Reglas de negocio

- **El anonimato es estructural, no una opcion de configuracion.** En una denuncia anonima no se escribe direccion IP, ni agente de usuario, ni ningun dato del denunciante. Los campos de identidad solo se llenan, y cifrados, cuando la persona eligio identificarse.
- **Codigo y clave, una sola vez.** Al enviar se genera un codigo de seguimiento y una clave de acceso de doce caracteres. La clave se guarda solo como hash y se devuelve una unica vez: si el denunciante la pierde, no hay forma de recuperarla, y esa es justamente la garantia de que nadie mas puede entrar a su caso.
- **Consulta y mensajes verificados con comparacion en tiempo constante.** El seguimiento exige codigo y clave; la comparacion del hash se hace con una funcion de tiempo constante para no filtrar informacion por la duracion de la respuesta. Un codigo o una clave incorrectos devuelven `ETHICS_CODE_INVALID` con 404, y no un 403: no se confirma siquiera que el codigo exista.
- **Plazo desde la categoria.** La fecha limite de la denuncia se calcula sumando los dias de plazo de su categoria, quince por defecto, referidos a la Ley 2466 de 2025 y a la politica interna. La gravedad inicial tambien la aporta la categoria.
- **Conflicto de interes** (`ETHICS_CONFLICT_OF_INTEREST`, 403). El caso guarda una lista de usuarios excluidos por estar implicados. Esos usuarios no ven la denuncia en el listado y, si piden el detalle directamente, reciben el error. La exclusion se aplica en la consulta, no solo en la interfaz.
- **Todo acceso queda registrado.** Listar, leer, abrir caso, responder y cerrar escriben una fila en `ethics_access_logs`. Ese registro es una tabla aparte de `sensitive_access_logs` justamente para que pueda conservarse aunque los demas registros se purguen por retencion.
- **Caso unico por denuncia.** El caso es uno por denuncia; volver a abrirlo actualiza el existente. Se numera `ETH-00001` a partir del conteo de la empresa y hereda la fecha limite de la denuncia. Si no se indica lider, queda quien lo abrio.
- **Abrir el caso mueve la denuncia** a `in_investigation`; cerrarla la pone en `closed` o `dismissed` segun si el caso se cierra con medidas o se desestima.
- **Estadisticas sin detalle.** El endpoint de estadisticas devuelve conteos y promedios. No expone asuntos, descripciones ni identidades, aunque quien consulta tenga el permiso de estadisticas.
- **Limites de tasa en el portal publico.** Enviar una denuncia esta limitado a cinco por hora; consultar el seguimiento y enviar mensajes, a veinte por hora; la vista del portal, a sesenta por minuto. Es lo que evita que alguien pruebe codigos a fuerza bruta o inunde el canal.

## Datos

| Tabla | Que guarda |
|---|---|
| `ethics_categories` | Categorias del canal, con su plazo en dias y su gravedad por defecto |
| `ethics_reports` | Denuncia: codigo de seguimiento, hash de la clave, si es anonima, relacion del denunciante, estado, gravedad y fecha limite |
| `ethics_report_messages` | Buzon de dos vias; cada mensaje indica si lo escribio el denunciante o el investigador |
| `ethics_cases` | Caso: numero, estado, gravedad, lider, usuarios excluidos y fechas de apertura y cierre |
| `ethics_case_members` | Integrantes del equipo de investigacion |
| `ethics_case_actions` | Acciones del plan de investigacion |
| `ethics_evidence` | Evidencias aportadas al caso |
| `ethics_access_logs` | Cada acceso a una denuncia o caso, con usuario y accion |

Columnas cifradas en reposo (AES-256-GCM):

- `ethics_reports`: `subject`, `description`, `involved_persons`, y `reporter_name`, `reporter_email`, `reporter_phone` cuando la denuncia no es anonima.
- `ethics_report_messages`: `body`.
- `ethics_cases`: `investigation_plan`, `conclusions`, `measures`.
- `ethics_case_actions`: `detail`.
- `ethics_evidence`: `description`.

La clave de acceso no se cifra: se guarda como hash, que es irreversible.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/ethics` | Canal de denuncias | Bandeja del oficial de etica, con el aviso de que cada consulta queda registrada |
| `/ethics/reports/:id` | Detalle de la denuncia | Contenido descifrado, apertura del caso, acciones, respuesta al denunciante y cierre |
| `/ethics/:companySlug` | Portal publico del canal | Envio de la denuncia sin sesion, anonima o identificada |
| `/ethics-seguimiento` | Seguimiento | El denunciante consulta su caso con codigo y clave y escribe al investigador |

## Limites

- No identifica al denunciante anonimo por ningun medio tecnico: no hay IP, ni agente de usuario, ni forma de recuperar la clave.
- No notifica al denunciante por correo: la unica via de vuelta es que entre con su codigo y su clave.
- No reporta a ninguna autoridad ni presenta la denuncia ante organismos externos; es un canal interno.
- No sanciona: las medidas se registran como texto del cierre. El proceso disciplinario, si lo hay, se lleva en ausencias y novedades.
- No aplica el flujo de aprobacion transversal: la decision del caso es del oficial de etica, no de una cadena de aprobadores.
- Las estadisticas no permiten desagregar hasta llegar a una persona.
