# Reclutamiento y seleccion

Cubre el camino desde que un area pide una persona hasta que esa persona queda
creada como colaborador. Lo usan los reclutadores para mover candidatos por el
pipeline, los jefes para pedir y aprobar requisiciones, y los candidatos desde
el portal publico de empleos, sin sesion.

## Que hace

- Recibe requisiciones de personal del area y las manda al flujo de aprobacion.
- Crea vacantes con un pipeline de etapas por defecto, configurable por vacante.
- Publica vacantes en el portal publico de empleos, con slug propio y control de si se muestra el rango salarial.
- Recibe postulaciones publicas: crea o actualiza el candidato, adjunta el CV y registra el consentimiento.
- Mueve postulaciones por el tablero Kanban guardando el historial de etapas.
- Descarta postulaciones con motivo obligatorio y decide si el candidato sigue en el banco.
- Programa entrevistas con participantes y genera la invitacion de calendario en formato ICS.
- Registra tarjetas de evaluacion de entrevista.
- Crea cartas de oferta con enlace unico para que el candidato responda sin sesion.
- Contrata: crea el colaborador y su usuario, abre el contrato, pasa el CV al legajo y dispara el onboarding.
- Lleva el banco de candidatos con busqueda sobre el texto del CV, etiquetas y calificacion.
- Registra referidos de colaboradores.
- Calcula indicadores del proceso: vacantes abiertas, postulaciones activas, contratados del ano, tiempo de contratacion y de cobertura.
- Anonimiza candidatos no contratados cuando vence su plazo de retencion.

## Permisos

| Permiso | Para que |
|---|---|
| `recruiting.requisition.read` | Ver requisiciones |
| `recruiting.requisition.create` | Crear una requisicion |
| `recruiting.requisition.update` | Editar una requisicion |
| `recruiting.requisition.delete` | Eliminar una requisicion |
| `recruiting.requisition.approve` | Aprobar una requisicion |
| `recruiting.job.read` | Ver vacantes, su detalle y los indicadores |
| `recruiting.job.create` | Crear una vacante |
| `recruiting.job.update` | Editar una vacante |
| `recruiting.job.delete` | Eliminar una vacante |
| `recruiting.job.publish` | Publicar y cerrar vacantes |
| `recruiting.candidate.read` | Ver el banco de candidatos |
| `recruiting.candidate.create` | Crear un candidato |
| `recruiting.candidate.update` | Editar la ficha, las notas, la calificacion y las etiquetas |
| `recruiting.candidate.delete` | Eliminar un candidato |
| `recruiting.candidate.export` | Exportar candidatos |
| `recruiting.application.read` | Ver el pipeline y el detalle de una postulacion |
| `recruiting.application.create` | Registrar una postulacion desde dentro |
| `recruiting.application.update` | Editar una postulacion |
| `recruiting.application.move` | Mover la postulacion de etapa |
| `recruiting.application.reject` | Descartar una postulacion |
| `recruiting.interview.read` | Ver la agenda de entrevistas y descargar el ICS |
| `recruiting.interview.create` | Programar una entrevista |
| `recruiting.interview.update` | Editar una entrevista |
| `recruiting.interview.delete` | Cancelar una entrevista |
| `recruiting.scorecard.read` | Ver tarjetas de evaluacion |
| `recruiting.scorecard.create` | Registrar una tarjeta de evaluacion |
| `recruiting.assessment.read`, `recruiting.assessment.create`, `recruiting.assessment.update` | Pruebas aplicadas al candidato |
| `recruiting.referencecheck.read`, `recruiting.referencecheck.create`, `recruiting.referencecheck.update` | Verificacion de referencias |
| `recruiting.offer.read` | Ver ofertas |
| `recruiting.offer.create` | Crear una carta de oferta |
| `recruiting.offer.update` | Editar una oferta |
| `recruiting.offer.send` | Enviar la oferta al candidato |
| `recruiting.hire.execute` | Contratar: crear colaborador, usuario, legajo y onboarding |
| `recruiting.referral.read`, `recruiting.referral.create`, `recruiting.referral.update` | Programa de referidos |
| `recruiting.settings.manage` | Configurar las etapas del pipeline de una vacante |

La anonimizacion por retencion no usa un permiso de reclutamiento: exige
`settings.retention.manage`, porque es una decision de tratamiento de datos.

## Endpoints

Prefijo `/recruiting`, salvo el portal publico.

### Requisiciones y vacantes

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/recruiting/requisitions` | Requisiciones de personal |
| POST | `/recruiting/requisitions` | Crea la requisicion y lanza su flujo de aprobacion |
| GET | `/recruiting/jobs` | Vacantes |
| GET | `/recruiting/jobs/:id` | Detalle con su pipeline |
| POST | `/recruiting/jobs` | Crea la vacante con el pipeline por defecto |
| PATCH | `/recruiting/jobs/:id` | Actualiza la vacante |
| POST | `/recruiting/jobs/:id/publish` | Publica en el portal de empleos |
| POST | `/recruiting/jobs/:id/close` | Cierra la vacante |
| POST | `/recruiting/jobs/:id/stages` | Reconfigura las etapas del pipeline |

### Postulaciones, entrevistas y ofertas

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/recruiting/jobs/:id/pipeline` | Tablero Kanban de la vacante |
| GET | `/recruiting/applications/:id` | Detalle de la postulacion |
| POST | `/recruiting/applications/:id/move` | Mueve de etapa y deja historial |
| POST | `/recruiting/applications/:id/reject` | Descarta con motivo obligatorio |
| POST | `/recruiting/applications/:id/hire` | Contrata al candidato |
| GET | `/recruiting/candidates` | Banco de candidatos, con busqueda y filtro por etiqueta |
| PATCH | `/recruiting/candidates/:id` | Calificacion, notas, etiquetas y texto del CV |
| POST | `/recruiting/interviews` | Programa una entrevista con participantes |
| GET | `/recruiting/interviews` | Agenda, filtrable por rango |
| GET | `/recruiting/interviews/:id/ics` | Invitacion de calendario |
| POST | `/recruiting/scorecards` | Tarjeta de evaluacion de una entrevista |
| POST | `/recruiting/offers` | Crea la carta de oferta con su token de acceso |
| POST | `/recruiting/offers/:id/send` | Marca la oferta como enviada |
| GET | `/recruiting/referrals` | Programa de referidos |
| GET | `/recruiting/metrics` | Indicadores del proceso |
| POST | `/recruiting/retention/anonymize` | Anonimiza candidatos vencidos |

### Portal publico, sin sesion

| Metodo | Ruta | Que hace |
|---|---|---|
| GET | `/public/careers/:companySlug` | Vacantes publicadas de la empresa |
| GET | `/public/careers/:companySlug/jobs/:jobSlug` | Detalle publico de una vacante |
| POST | `/public/careers/:companySlug/jobs/:jobSlug/apply` | Postulacion publica |
| POST | `/public/:companySlug/uploads` | URL prefirmada para adjuntar el CV |
| POST | `/public/:companySlug/uploads/:fileId/confirm` | Confirma la subida |
| GET | `/public/offers/:token` | Carta de oferta por enlace unico |
| POST | `/public/offers/:token/respond` | El candidato acepta o rechaza |

## Reglas de negocio

- **Codigos consecutivos.** Las requisiciones se numeran `REQ-0001` y las vacantes `VAC-0001`, a partir del conteo de la empresa.
- **Slug unico por vacante.** El titulo se convierte en slug y, si ya existe, se le agrega un sufijo numerico hasta encontrar uno libre. Ese slug es la URL publica de la vacante.
- **Requisicion aprobada antes de publicar.** Nace en `pending_approval` y abre una instancia de flujo. Si el motor resuelve aprobado de inmediato, la requisicion queda aprobada con su fecha.
- **Pipeline por defecto.** Toda vacante nace con nueve etapas: Nuevo, Preseleccion, Entrevista HR, Prueba tecnica, Entrevista jefe, Referencias, Oferta, Contratado y Descartado. Cada etapa tiene un `kind` que el sistema usa para decidir, no un nombre: mover a una etapa de tipo `rejected` marca la postulacion como descartada, y contratar la lleva a la de tipo `hired`. Asi el pipeline se puede renombrar y reordenar sin romper la logica.
- **Solo se publica lo que corresponde.** El portal publico muestra unicamente vacantes en estado `published`, no internas, no borradas y cuya fecha de cierre no haya pasado.
- **El rango salarial se muestra solo si se autorizo.** Esta cifrado en la base y solo se descifra hacia el portal cuando `salary_visible` es verdadero.
- **Postulacion publica.** Si ya existe un candidato con ese correo o ese documento, se actualiza en vez de duplicarlo. Si el candidato ya se postulo a esa misma vacante, falla con `DUPLICATE_CANDIDATE` (409). La postulacion entra en la primera etapa del pipeline. Si la vacante ya cerro, se rechaza con `VALIDATION_FAILED`.
- **Consentimiento y retencion en el mismo acto.** Al postularse se sella `consent_at` y se fija `retention_until` a doce meses desde hoy.
- **Mover de etapa valida pertenencia.** La etapa destino debe pertenecer al pipeline de esa vacante; si no, `APPLICATION_STAGE_INVALID` (422). Cada movimiento deja una fila en el historial con etapa de origen, destino, nota y quien movio.
- **Descartar exige motivo** (`REJECTION_REASON_REQUIRED`, 422) y guarda ademas si el candidato se conserva en el banco de talento.
- **Contratar es una operacion compuesta.** Si la postulacion ya esta contratada falla con `ALREADY_HIRED` (409). Si no, crea el colaborador reutilizando los datos de la vacante cuando el formulario no los trae, crea su usuario, abre el contrato vigente, copia los documentos del candidato al legajo bajo el tipo `hoja_vida` (que se crea si no existe), marca la postulacion como contratada, la lleva a la etapa de tipo `hired` y limpia `retention_until` del candidato porque ya no es un dato de candidato sino de colaborador.
- **Cierre automatico de la vacante.** Cuando el numero de contratados alcanza los cupos (`openings`), la vacante pasa a `closed` con su fecha.
- **Documento provisional.** Si el candidato no dejo numero de documento, el colaborador se crea con `TMP-` y los primeros ocho caracteres del id del candidato, para no bloquear la contratacion; queda por corregir en la ficha.
- **Contratar emite `employee.hired`,** que es lo que el modulo de onboarding escucha para abrir el proceso de ingreso.
- **Busqueda sobre el CV.** El banco de candidatos busca por nombre, correo, documento y tambien dentro de `resume_text`, el texto plano extraido del CV. La lista excluye a los ya anonimizados.
- **Anonimizacion por retencion.** Procesa hasta 500 candidatos por corrida: solo los no contratados, no anonimizados y con `retention_until` vencido. Reemplaza nombre, correo, telefono, documento, LinkedIn, texto del CV y notas, borra sus documentos y sella `anonymized_at`. El registro no se elimina, para no perder las estadisticas del proceso.
- **Oferta por enlace.** Al crearla se genera un token aleatorio que el candidato usa para verla y responder sin sesion. Enviar solo cambia el estado a `sent` y sella la fecha.
- **Indicadores.** El tiempo de contratacion se mide de la postulacion a la contratacion; el de cobertura, de la publicacion de la vacante a la contratacion, y solo sobre vacantes que llegaron a publicarse. Ambos promedian las ultimas 200 contrataciones.

## Datos

| Tabla | Que guarda |
|---|---|
| `job_requisitions` | Pedido del area: motivo, cupos, fecha requerida, justificacion y a quien reemplaza |
| `job_postings` | Vacante publicable: slug, descripcion, requisitos, beneficios, cupos, reclutador y jefe solicitante |
| `pipeline_stages` | Etapas por vacante con su orden, color, `kind` y plantilla de correo automatico |
| `job_competencies` | Competencias asociadas a la vacante |
| `candidates` | Ficha del candidato, `resume_text` para busqueda, consentimiento, retencion y anonimizacion |
| `candidate_tags`, `candidate_documents` | Etiquetas y archivos del candidato |
| `applications` | Postulacion a una vacante: etapa, estado, carta, respuestas, motivo de descarte |
| `application_stage_history` | Cada movimiento entre etapas |
| `interviews`, `interview_participants` | Entrevistas, su modalidad y quienes participan |
| `interview_feedback`, `interview_feedback_ratings` | Tarjetas de evaluacion y su detalle por competencia |
| `assessments`, `reference_checks` | Pruebas aplicadas y verificacion de referencias |
| `offers` | Carta de oferta, su estado, token de acceso y vencimiento |
| `referrals` | Referidos, con nota informativa del reconocimiento |

Columnas cifradas en reposo:

- `job_requisitions`: `salary_range_min`, `salary_range_max`.
- `job_postings`: `salary_range_min`, `salary_range_max`.
- `offers`: `salary`.

El esquema marca los tres como informativos. El reconocimiento por referido se
guarda como nota y fecha de pago, nunca como importe calculado.

## Pantallas

| Ruta | Pagina | Que permite |
|---|---|---|
| `/recruiting` | Vacantes | Lista de vacantes, creacion, publicacion y cierre |
| `/recruiting/jobs/:id` | Pipeline | Tablero Kanban de la vacante: mover, descartar y contratar |
| `/recruiting/candidatos` | Banco de candidatos | Busqueda por texto del CV, etiquetas y calificacion |
| `/recruiting/requisiciones` | Requisiciones de personal | El area solicita, Talento Humano valida y gerencia aprueba |
| `/careers/:companySlug` | Portal de empleos | Vacantes publicadas, sin sesion |
| `/careers/:companySlug/:jobSlug` | Detalle de vacante | Formulario de postulacion con adjunto del CV |

## Limites

- No liquida nomina ni calcula el costo de la contratacion. Los rangos salariales y el salario de la oferta son informativos y estan cifrados.
- No publica en portales externos de empleo: la publicacion es en el portal propio de la empresa.
- No hace video entrevistas ni calificacion automatica de candidatos.
- No envia correos por si mismo al mover de etapa: cuando la etapa tiene plantilla asociada, deja el registro en el log y la entrega queda en manos del modulo de notificaciones.
- No firma la oferta ni el contrato; la firma vive en el modulo de documentos.
- No verifica antecedentes contra fuentes externas: la verificacion de referencias es un registro manual.
