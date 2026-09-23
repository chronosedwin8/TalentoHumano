# Documentos y politicas

Emite los papeles que la empresa entrega al colaborador (certificados, cartas,
actas) y publica las politicas y reglamentos que el colaborador debe leer y
acusar. Talento Humano define las plantillas y las politicas; el colaborador
genera su certificado sin pedirlo y deja constancia de que leyo. Todo documento
generado sale con un codigo que un tercero puede verificar sin iniciar sesion.

## Que hace

- Administra plantillas de documento por tipo: carta, certificado, acta, contrato o memorando.
- Permite escribir la plantilla en bloques o en HTML directo, con variables `{{...}}` que se reemplazan al generar.
- Publica el catalogo de variables disponibles (empresa, colaborador, cargo, area, sede, contrato, fecha de hoy y ano).
- Genera un documento a partir de una plantilla para un colaborador, con las variables ya resueltas.
- Genera el mismo documento para varios colaboradores en una sola operacion, hasta 500.
- Deja que el colaborador emita su propio certificado laboral desde el portal, si la plantilla esta habilitada para autoservicio.
- Guarda cada documento generado como HTML listo para imprimir, con encabezado, codigo de verificacion y QR.
- Expone la verificacion publica del documento por su codigo, sin sesion y sin exponer datos personales.
- Crea politicas y reglamentos versionados, cada version con nota de cambio y fecha de vigencia.
- Publica una version y abre el acuse de lectura para todo el personal activo, con notificacion.
- Registra el acuse de lectura y, cuando se pide o la politica lo exige, una firma simple con sello de tiempo.
- Entrega el reporte de acuses de una politica, colaborador por colaborador.
- Lista las solicitudes de firma con sus firmas asociadas.

## Permisos

| Permiso | Para que |
|---|---|
| `documents.template.read` | Ver las plantillas y el catalogo de variables |
| `documents.template.create` | Crear una plantilla |
| `documents.template.update` | Editar una plantilla |
| `documents.template.delete` | Eliminar logicamente una plantilla |
| `documents.generated.read` | Ver el registro de documentos generados y su contenido |
| `documents.generated.create` | Generar documentos, individuales o masivos |
| `documents.policy.read` | Ver politicas, ver las propias pendientes y registrar el acuse |
| `documents.policy.create` | Crear una politica con su primera version |
| `documents.policy.update` | Crear una nueva version de una politica |
| `documents.policy.publish` | Publicar una version y solicitar los acuses |
| `documents.acknowledgement.read` | Ver el reporte de acuses de una politica |
| `documents.signature.read` | Ver las solicitudes de firma |
| `documents.signature.request` | Solicitar una firma; hoy no tiene endpoint propio |
| `documents.certificate.create` | Generar el certificado laboral de autoservicio |

## Endpoints

Prefijo `/documents`, salvo la verificacion publica alterna.

### Plantillas

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/documents/templates` | Plantillas no eliminadas, paginadas y ordenadas por nombre |
| GET | `/documents/templates/variables` | Catalogo plano de variables `{{ruta}}` disponibles |
| POST | `/documents/templates` | Crea una plantilla |
| PATCH | `/documents/templates/:id` | Actualiza una plantilla |
| DELETE | `/documents/templates/:id` | Borrado logico de la plantilla |

### Documentos generados

| Metodo | Ruta | Que hace |
|---|---|---|
| POST | `/documents/generate` | Genera un documento desde una plantilla, con variables extra opcionales |
| POST | `/documents/generate/bulk` | Genera el mismo documento para una lista de colaboradores |
| POST | `/documents/self-service/certificate` | El colaborador emite su certificado laboral |
| GET | `/documents/generated` | Registro de documentos generados, filtrable por `employeeId` |
| GET | `/documents/generated/:id` | Documento completo, con el HTML listo para imprimir |
| GET | `/documents/verify/:code` | Verificacion publica por codigo; sin sesion |
| GET | `/public/verify/:code` | Misma verificacion en el portal publico, con limite de 60 consultas por minuto |

### Politicas y firmas

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/documents/policies` | Politicas con su ultima version y el conteo de acuses |
| POST | `/documents/policies` | Crea la politica y su version 1 |
| POST | `/documents/policies/:id/versions` | Agrega una version nueva y mueve `current_version` |
| POST | `/documents/policies/:id/publish` | Publica la version y abre los acuses |
| GET | `/documents/policies/mine` | Politicas pendientes de acuse del colaborador conectado |
| POST | `/documents/policies/versions/:versionId/acknowledge` | Registra el acuse y, si aplica, la firma simple |
| GET | `/documents/policies/:id/acknowledgements` | Reporte de acuses de la politica |
| GET | `/documents/signatures` | Solicitudes de firma con sus firmas |

## Reglas de negocio

- **Modulo activo.** Todo el controlador exige el modulo `documents`. Si la empresa no lo tiene asignado, la respuesta es `MODULE_DISABLED` (403) antes de evaluar cualquier permiso.
- **Generar exige plantilla viva.** La plantilla debe existir en la empresa y no estar eliminada; si no, `NOT_FOUND` (404).
- **Autoservicio con doble candado.** El usuario debe estar vinculado a un colaborador, o la respuesta es `FORBIDDEN` (403). Si no se indica plantilla se busca la primera marcada `is_self_service` de tipo `certificate`; si no hay ninguna habilitada, `NOT_FOUND` (404). Generar por autoservicio una plantilla que no esta marcada como tal tambien devuelve `FORBIDDEN` (403).
- **Codigo de verificacion irrepetible.** Se arma con un SHA-256 de empresa, semilla (colaborador o usuario), marca de tiempo y un numero aleatorio; se toman 12 caracteres en mayusculas y se formatean como `TAL-XXXX-XXXX-XXXX`. La columna es unica en toda la base.
- **Que lleva el QR.** El QR codifica la URL publica `<WEB_URL>/verificar/<codigo>`, no datos del documento. Quien lo escanea llega a una pagina que confirma la emision; el documento en si nunca viaja en el codigo.
- **La verificacion publica no expone datos personales.** Devuelve empresa, titulo, fecha de emision, nombre del titular y el numero de documento enmascarado a sus ultimos cuatro digitos. `/documents/verify/:code` responde `NOT_FOUND` (404) si el codigo no existe; `/public/verify/:code` responde `{ valid: false }` y omite el numero de documento.
- **El documento se congela al generarse.** Se guarda el HTML ya renderizado y el diccionario de variables usado. Cambiar despues la plantilla o el cargo del colaborador no altera lo ya emitido.
- **Variables sin valor quedan vacias.** El reemplazo recorre la ruta del punto dentro del contexto; si no encuentra nada, escribe cadena vacia en lugar de dejar el marcador visible.
- **Politica versionada, nunca reescrita.** Una version nueva toma el consecutivo de la ultima mas uno y se guarda aparte; la politica solo actualiza `current_version`. El texto anterior queda intacto para poder probar que se acuso.
- **Publicar reparte los acuses.** Sella `published_at` en la version, pone la politica en `published` y, si la politica exige acuse, crea un pendiente por cada colaborador `active` u `on_leave` mediante `upsert` sobre `(version_id, employee_id)`, de modo que republicar no duplica. Luego notifica a todos con `force` y emite `policy.published`.
- **Acusar exige colaborador.** Sin vinculo a un colaborador el acuse falla con `FORBIDDEN` (403); si la version no existe, `NOT_FOUND` (404). El acuse tambien es `upsert`, asi que volver a acusar actualiza las fechas en vez de crear otro registro.
- **Como se sella la firma simple.** Cuando el colaborador pide firmar o la politica lo exige, se crea una solicitud de firma sobre `policy_version` en estado `signed` y una firma que guarda nombre del firmante, usuario, fecha, IP, agente del navegador y un SHA-256 de la version, el usuario y el instante de la firma. El proveedor y el metodo quedan como `simple`.
- **Generacion masiva secuencial.** El lote recorre la lista uno por uno y devuelve por cada colaborador el id del documento y su codigo; el limite de 500 por llamada esta en el esquema de entrada.

## Datos

| Tabla | Que guarda |
|---|---|
| `document_templates` | Plantilla por empresa y codigo: tipo, bloques, HTML alterno, variables declaradas, si es autoservicio y si exige firma |
| `generated_documents` | Documento emitido: titulo, codigo de verificacion unico, HTML congelado, variables usadas y si fue autoservicio |
| `policies` | Politica por empresa y codigo: titulo, categoria, resumen, estado, si exige acuse y firma, version vigente |
| `policy_versions` | Cada version con sus bloques, nota de cambio, fecha de publicacion y de vigencia |
| `policy_acknowledgements` | Acuse por version y colaborador: fecha de lectura, de acuse y firma asociada |
| `signature_requests` | Solicitud de firma sobre una entidad, con estado, proveedor y referencia externa |
| `signatures` | Firma ejecutada: nombre, usuario, fecha, hash, IP, agente y metodo |

Ninguna columna de este modulo va cifrada: el esquema no marca campos como
cifrados y el servicio no llama al cifrador. El contenido de un certificado o de
una politica es un documento entregable, no un dato reservado.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/documents` | Documentos generados / Mis documentos | Registro de emisiones, vista previa e impresion; con `documents.certificate.create` tambien emite el certificado laboral |
| `/documents/plantillas` | Plantillas de documentos | Crear y editar plantillas, ver las variables y generar en lote |
| `/documents/policies` | Politicas y reglamentos | Crear politicas, publicar versiones, acusar lectura y ver el reporte de acuses |
| `/portal/documentos` | Mis documentos | La misma bandeja, limitada al colaborador dentro del portal |
| `/verificar/:code` | Verificacion de documento | Pagina publica que confirma si el codigo corresponde a un documento emitido |

El titulo de la primera pantalla cambia segun el permiso: quien tiene
`documents.generated.read` ve "Documentos generados"; el resto ve
"Mis documentos" y solo su propia lista.

## Limites

- La firma es simple: nombre, usuario, fecha, IP, agente del navegador y un hash. No es firma digital certificada, no usa certificados ni entidades de certificacion, y no hay estampado cronologico de un tercero.
- El hash cubre el identificador de la version, el usuario y el instante de la firma; no es un sello sobre el archivo PDF.
- No produce el PDF por su cuenta. Guarda HTML listo para imprimir y deja que el navegador lo convierta; el renderizador dedicado es un punto de extension aun sin implementar.
- No liquida nomina ni lleva contabilidad. Un certificado toma los datos ya registrados del colaborador y su contrato; no calcula valores.
- La plataforma no valida la veracidad del contenido de la plantilla: lo que se escribe se emite.
- No hay flujo de firma por terceros ni envio a un firmante externo. Las solicitudes de firma que existen se crean desde el acuse de una politica.
- No existe endpoint para editar o eliminar una politica publicada: se corrige creando una version nueva.
