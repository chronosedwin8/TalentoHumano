# Seguridad y salud en el trabajo

Sostiene la evidencia del SG-SST: examenes medicos ocupacionales, accidentalidad,
matriz de peligros, entrega de EPP, inspecciones y comites. Lo usa el responsable
de SST para tener en un solo lugar lo que pide el Decreto 1072 de 2015, y la
gerencia para leer los indicadores minimos de la Resolucion 0312 de 2019. La
plataforma registra y calcula; el reporte legal sigue saliendo por los canales
oficiales de la ARL.

## Que hace

- Registra examenes medicos ocupacionales por tipo (ingreso, periodico, retiro, post incapacidad, especial), con proveedor, fecha, vencimiento y resultado.
- Guarda cifradas las restricciones y las recomendaciones medicas, y deja rastro de cada lectura.
- Lista los examenes que vencen dentro de un horizonte de dias.
- Registra accidentes de trabajo, incidentes y enfermedades laborales con codigo consecutivo, gravedad, parte del cuerpo afectada, lugar y dias perdidos.
- Guarda la investigacion del evento: causa raiz, causas inmediatas, causas basicas y plan de accion.
- Mantiene la matriz de peligros y riesgos y calcula el nivel a partir de probabilidad por consecuencia.
- Registra la entrega de elementos de proteccion personal con fecha de entrega y de reposicion.
- Programa y registra inspecciones de seguridad con hallazgos y plan de accion.
- Administra COPASST, comite de convivencia, comite de emergencias y otros, con vigencia, integrantes y actas.
- Calcula por ano los indicadores de frecuencia, severidad y ausentismo por causa medica.

## Permisos

| Permiso | Para que |
|---|---|
| `sst.medicalexam.read` | Ver examenes medicos y los proximos a vencer; el catalogo lo marca como sensible, asi que cada consulta queda registrada |
| `sst.medicalexam.create` | Registrar un examen medico ocupacional |
| `sst.medicalexam.update` | Declarado en el catalogo; hoy ningun endpoint lo exige |
| `sst.accident.read` | Ver accidentes, incidentes y enfermedades laborales |
| `sst.accident.create` | Reportar un evento |
| `sst.accident.update` | Registrar o actualizar la investigacion y el plan de accion |
| `sst.risk.manage` | Ver y alimentar la matriz de peligros y riesgos |
| `sst.ppe.read` | Ver las entregas de EPP |
| `sst.ppe.create` | Registrar una entrega de EPP |
| `sst.inspection.read` | Ver las inspecciones de seguridad |
| `sst.inspection.create` | Programar o registrar una inspeccion |
| `sst.inspection.update` | Declarado en el catalogo; hoy ningun endpoint lo exige |
| `sst.committee.manage` | Ver y crear comites, integrantes y actas |
| `sst.indicator.read` | Ver los indicadores de la Resolucion 0312 |

## Endpoints

Prefijo `/sst`. Todo el controlador exige que el modulo `sst` este activo para la
empresa y asignado al usuario; si no, la respuesta es `MODULE_DISABLED` (403).

### Examenes medicos

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/sst/medical-exams` | Examenes paginados, filtrables por colaborador y tipo, con restricciones y recomendaciones descifradas |
| POST | `/sst/medical-exams` | Registra un examen y cifra el contenido clinico |
| GET | `/sst/medical-exams/expiring` | Examenes con vencimiento dentro de `days` (60 por defecto), hasta 200 |

### Accidentalidad

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/sst/accidents` | Eventos paginados, filtrables por tipo y rango de fechas, con su investigacion |
| POST | `/sst/accidents` | Registra el evento y le asigna el codigo consecutivo |
| POST | `/sst/accidents/:id/investigation` | Crea o actualiza la investigacion y el plan de accion |

### Matriz de riesgos y EPP

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/sst/risks` | Entradas de la matriz de peligros |
| POST | `/sst/risks` | Agrega un peligro y calcula su nivel de riesgo |
| GET | `/sst/ppe` | Entregas de EPP, filtrables por colaborador |
| POST | `/sst/ppe` | Registra una entrega |

### Inspecciones y comites

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/sst/inspections` | Inspecciones programadas y realizadas |
| POST | `/sst/inspections` | Programa o registra una inspeccion |
| GET | `/sst/committees` | Comites con sus integrantes y las ultimas cinco actas |
| POST | `/sst/committees` | Crea el comite y sus integrantes en una sola llamada |
| POST | `/sst/committees/:id/minutes` | Registra un acta del comite |

### Indicadores

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/sst/indicators` | Indicadores del ano indicado en `year`, o del ano en curso |

## Reglas de negocio

- **El contenido clinico se cifra al escribir y se descifra al leer.** `restrictions` y `recommendations` pasan por `encryption.encrypt` al crear el examen y por `encryption.decrypt` al listarlo. El resto de la fila (tipo, fechas, proveedor, resultado) queda en claro.
- **La lectura de examenes deja rastro.** El listado lleva `@SensitiveAccess('medical_exam')`, asi que cada consulta se escribe en `sensitive_access_logs`. Es la contrapartida de guardar informacion de salud: no se impide el acceso legitimo, se deja constancia de quien miro.
- **Que exige registrar un accidente.** Solo tres datos son obligatorios: el colaborador, la fecha y hora de ocurrencia y una descripcion de entre 10 y 20.000 caracteres. El tipo nace como `accident`, la gravedad como `low` y los dias perdidos en 0. Si no se envia `reportedAt` se sella la fecha del registro. El numero FURAT es opcional y el esquema lo describe como informativo: aqui no se radica nada.
- **Codigo consecutivo por evento.** Se genera `ATEL-<ano>-0001` a partir del conteo de eventos de la empresa, y la base lo protege con `@@unique([companyId, code])`.
- **Una investigacion por accidente.** El endpoint hace `upsert` sobre `accidentId`, que es unico: volver a llamarlo actualiza la investigacion existente en vez de crear otra.
- **Nivel de riesgo calculado, no escrito a mano.** `probabilidad x consecuencia` (cada una de 1 a 5) da un puntaje que se traduce a `critico` desde 20, `alto` desde 12, `medio` desde 6 y `bajo` por debajo. El nivel residual y la fecha de revision existen en la tabla pero ningun endpoint los escribe.
- **Indicadores de la Resolucion 0312.** El rango va del 1 de enero al 31 de diciembre del ano pedido, en UTC. Sobre ese rango:
  - `frequencyRate` = accidentes de tipo `accident` / colaboradores activos x 100. Se lee como accidentes por cada 100 trabajadores.
  - `severityRate` = suma de dias perdidos de todos los eventos / colaboradores activos x 100. Se lee como dias perdidos por cada 100 trabajadores.
  - `medicalAbsenteeismRate` = dias de incapacidad / dias laborables x 100, donde los dias laborables son `activos x 240` (240 dias por persona y ano) y los dias de incapacidad salen de las ausencias `approved` o `taken` cuyo tipo tiene codigo `incapacidad_eps` o `incapacidad_arl`.
  - Los tres se redondean a dos decimales y devuelven 0 cuando el denominador es cero, para no dividir por cero en una empresa recien creada.
  - Ademas se devuelven el conteo de incidentes, el de enfermedades laborales, los dias perdidos, el numero de incapacidades y los dias totales de ausencia del ano.
  - El ausentismo depende de que existan tipos de ausencia con esos dos codigos exactos: sin ellos el indicador sale en 0 aunque haya incapacidades registradas con otro codigo.
- **Comites con integrantes en la misma llamada.** El comite se crea con su vigencia y los integrantes se insertan en lote. La base impide repetir a una persona en el mismo comite (`@@unique([committeeId, employeeId])`) y repetir el numero de un acta (`@@unique([committeeId, number])`).
- **Examenes por vencer sin piso.** El filtro solo pone techo (`expiresAt <= hoy + days`), asi que la lista incluye tambien los ya vencidos, ordenados del mas antiguo al mas proximo.
- **Toda escritura queda auditada.** Cada `POST` lleva `@Audit` con su tipo de entidad.
- **Borrado logico.** Examenes, accidentes, riesgos, inspecciones y comites filtran por `deleted_at IS NULL`, pero ningun endpoint del modulo elimina registros.
- **Errores.** Un cuerpo que no pasa el esquema devuelve `VALIDATION_FAILED` (422) con la lista de campos; faltar el permiso devuelve `PERMISSION_DENIED` (403) indicando cual.

## Datos

| Tabla | Que guarda |
|---|---|
| `medical_exams` | Tipo, proveedor, fecha, vencimiento, resultado, restricciones y recomendaciones |
| `work_accidents` | Codigo, tipo, fecha de ocurrencia y de reporte, lugar, parte del cuerpo, gravedad, descripcion, numero FURAT y dias perdidos |
| `accident_investigations` | Causa raiz, causas inmediatas, causas basicas, plan de accion y fecha de cierre; una por accidente |
| `risk_matrix_entries` | Peligro, clase, riesgo, expuestos, probabilidad, consecuencia, nivel calculado, controles y nivel residual |
| `ppe_deliveries` | Elemento, cantidad, fecha de entrega y de reposicion, acta y firma |
| `sst_inspections` | Titulo, tipo, sede, fechas programada y realizada, inspector, hallazgos y plan de accion |
| `committees`, `committee_members`, `committee_minutes` | Comites con vigencia, integrantes con representacion y principalidad, y actas con orden del dia, decisiones y asistentes |

Columnas cifradas en reposo:

- `medical_exams`: `restrictions` y `recommendations`. El esquema las marca con
  `/// Encrypted at rest; requires sst.medicalexam.read`. Ninguna otra tabla del
  modulo cifra columnas.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/sst` | Seguridad y salud en el trabajo | Pestanas Indicadores, Examenes medicos, Accidentalidad, Matriz de riesgos, EPP, Inspecciones y Comites |

Las pestanas aparecen segun los permisos del usuario; solo Indicadores se muestra
siempre. Desde la pagina se puede registrar un examen, reportar un evento,
agregar un peligro, registrar una entrega de EPP y crear una inspeccion. Los
comites se consultan en tarjetas, sin crearlos desde la interfaz, y la
investigacion de un accidente solo se registra por API.

## Limites

- No liquida nomina ni lleva contabilidad: no valoriza dias perdidos, incapacidades ni EPP entregados.
- No reemplaza el reporte legal ante la ARL ni ante la EPS. El numero FURAT es un campo informativo y el codigo no radica, no transcribe ni notifica a ninguna entidad.
- No hay pantalla ni endpoint para cerrar un accidente: el estado del evento nace en `open` y ningun endpoint lo cambia.
- No edita ni elimina lo registrado: los endpoints del modulo solo crean y consultan, salvo la investigacion, que se actualiza por `upsert`.
- No calcula el nivel de riesgo residual ni controla el plan de mejora: los campos existen, pero no se escriben.
- No genera el plan anual de trabajo, la matriz legal ni la autoevaluacion de estandares minimos.
- No convoca elecciones de COPASST ni firma actas; guarda el resultado.
- Los indicadores se calculan sobre los datos cargados en la plataforma: lo que no se registre aqui no aparece en el ano.
