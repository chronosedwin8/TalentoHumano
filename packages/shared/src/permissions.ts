import { MODULES, type ModuleKey } from './modules.js';

/** Data scope attached to a permission grant. */
export const SCOPES = ['own', 'team', 'area', 'company'] as const;
export type Scope = (typeof SCOPES)[number];

/** Ordered from narrowest to widest; used to compare grants. */
export const SCOPE_RANK: Record<Scope, number> = { own: 1, team: 2, area: 3, company: 4 };

export interface PermissionDefinition {
  code: string;
  module: ModuleKey;
  resource: string;
  action: string;
  /** Human label (Spanish) shown in the role builder. */
  label: string;
  /** Reading through this permission is recorded in sensitive_access_logs. */
  sensitive?: boolean;
}

type ResourceSpec = [resource: string, label: string, actions: string[], sensitive?: boolean];

export const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Administrar',
  approve: 'Aprobar',
  reject: 'Rechazar',
  publish: 'Publicar',
  export: 'Exportar',
  import: 'Importar',
  execute: 'Ejecutar',
  assign: 'Asignar',
  close: 'Cerrar',
  move: 'Mover de etapa',
  send: 'Enviar',
  submit: 'Responder',
  complete: 'Completar',
  cancel: 'Anular',
  adjust: 'Ajustar',
  impersonate: 'Suplantar',
  moderate: 'Moderar',
  calibrate: 'Calibrar',
  respond: 'Responder',
  triage: 'Clasificar',
  request: 'Solicitar',
  upload: 'Subir',
  issue: 'Emitir',
  delegate: 'Delegar',
  run: 'Ejecutar',
};

function build(module: ModuleKey, specs: ResourceSpec[]): PermissionDefinition[] {
  const out: PermissionDefinition[] = [];
  for (const [resource, label, actions, sensitive] of specs) {
    for (const action of actions) {
      out.push({
        code: [module, resource, action].join('.'),
        module,
        resource,
        action,
        label: label + ' - ' + (ACTION_LABELS[action] ?? action),
        ...(sensitive ? { sensitive: true } : {}),
      });
    }
  }
  return out;
}

const CRUD = ['read', 'create', 'update', 'delete'];

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  ...build(MODULES.DASHBOARD, [
    ['executive', 'Tablero ejecutivo', ['read']],
    ['team', 'Tablero de equipo', ['read']],
  ]),

  ...build(MODULES.SETTINGS, [
    ['company', 'Empresa y marca', ['read', 'update']],
    ['location', 'Sedes', CRUD],
    ['department', 'Areas', CRUD],
    ['position', 'Cargos', CRUD],
    ['costcenter', 'Centros de costo', CRUD],
    ['user', 'Usuarios', [...CRUD, 'impersonate']],
    ['role', 'Roles y permisos', CRUD],
    ['module', 'Modulos visibles', ['manage']],
    ['catalog', 'Catalogos configurables', ['manage']],
    ['customfield', 'Campos personalizados', ['manage']],
    ['workflow', 'Flujos de aprobacion', ['manage']],
    ['notification', 'Plantillas de notificacion', ['manage']],
    ['form', 'Formularios dinamicos', ['manage']],
    ['integration', 'Integraciones, API keys y webhooks', ['manage']],
    ['delegation', 'Delegaciones', ['manage']],
    ['audit', 'Auditoria', ['read']],
    ['retention', 'Retencion y Habeas Data', ['manage']],
  ]),

  ...build(MODULES.PEOPLE, [
    ['employee', 'Colaboradores', [...CRUD, 'export', 'import']],
    ['sensitive', 'Datos sensibles del colaborador', ['read'], true],
    ['contract', 'Contratos', CRUD],
    ['movement', 'Movimientos de personal', ['read', 'create', 'update', 'approve']],
    ['document', 'Legajo digital', [...CRUD, 'request']],
    ['documenttype', 'Tipos de documento', ['manage']],
    ['asset', 'Activos asignados', CRUD],
    ['orgchart', 'Organigrama', ['read']],
    ['directory', 'Directorio', ['read']],
    ['changerequest', 'Solicitudes de cambio de datos', ['read', 'approve']],
  ]),

  ...build(MODULES.RECRUITING, [
    ['requisition', 'Requisiciones de personal', [...CRUD, 'approve']],
    ['job', 'Vacantes', [...CRUD, 'publish']],
    ['candidate', 'Candidatos', [...CRUD, 'export']],
    ['application', 'Postulaciones', ['read', 'create', 'update', 'move', 'reject']],
    ['interview', 'Entrevistas', CRUD],
    ['scorecard', 'Tarjetas de evaluacion', ['read', 'create']],
    ['assessment', 'Pruebas', ['read', 'create', 'update']],
    ['referencecheck', 'Verificacion de referencias', ['read', 'create', 'update']],
    ['offer', 'Ofertas', ['read', 'create', 'update', 'send']],
    ['hire', 'Contratacion', ['execute']],
    ['referral', 'Programa de referidos', ['read', 'create', 'update']],
    ['settings', 'Configuracion de reclutamiento', ['manage']],
  ]),

  ...build(MODULES.ONBOARDING, [
    ['template', 'Plantillas de ingreso', CRUD],
    ['process', 'Procesos de ingreso', CRUD],
    ['task', 'Tareas de ingreso', ['read', 'update', 'complete']],
    ['offboarding', 'Procesos de salida', CRUD],
    ['exitinterview', 'Entrevistas de retiro', ['read', 'create']],
  ]),

  ...build(MODULES.LEAVES, [
    ['type', 'Tipos de ausencia', ['manage']],
    ['policy', 'Politicas de vacaciones', ['manage']],
    ['balance', 'Saldos de vacaciones', ['read', 'adjust']],
    ['request', 'Solicitudes de ausencia', ['read', 'create', 'update', 'cancel', 'approve']],
    ['holiday', 'Festivos', ['manage']],
    ['event', 'Novedades del colaborador', CRUD],
    ['disciplinary', 'Procesos disciplinarios', ['read', 'create', 'update'], true],
    ['export', 'Exportacion a nomina externa', ['execute']],
  ]),

  ...build(MODULES.TIME, [
    ['schedule', 'Horarios de trabajo', ['manage']],
    ['shift', 'Turnos', [...CRUD, 'publish']],
    ['swap', 'Cambios de turno', ['request', 'approve']],
    ['clock', 'Marcacion', ['create', 'read']],
    ['attendance', 'Asistencia diaria', ['read', 'update']],
    ['justification', 'Justificaciones', ['create', 'approve']],
    ['device', 'Dispositivos de marcacion', ['manage']],
    ['report', 'Reportes de asistencia', ['read', 'export']],
  ]),

  ...build(MODULES.LEARNING, [
    ['course', 'Cursos', [...CRUD, 'publish']],
    ['lesson', 'Lecciones y contenido', CRUD],
    ['media', 'Galeria de medios', ['read', 'upload', 'delete']],
    ['pattern', 'Patrones de contenido', ['manage']],
    ['embedprovider', 'Proveedores de embed', ['manage']],
    ['quiz', 'Cuestionarios y banco de preguntas', ['manage']],
    ['enrollment', 'Inscripciones', ['read', 'create', 'delete']],
    ['path', 'Rutas de aprendizaje', ['manage']],
    ['session', 'Sesiones presenciales y virtuales', ['read', 'create', 'update']],
    ['progress', 'Progreso y calificaciones', ['read']],
    ['certificate', 'Certificados', ['read', 'issue']],
    ['plan', 'Plan anual de capacitacion', ['manage']],
  ]),

  ...build(MODULES.PERFORMANCE, [
    ['competency', 'Diccionario de competencias', ['manage']],
    ['objective', 'Objetivos y OKR', CRUD],
    ['checkin', 'Check-ins de resultados clave', ['create']],
    ['cycle', 'Ciclos de evaluacion', ['read', 'create', 'update', 'close']],
    ['review', 'Evaluaciones', ['read', 'respond', 'calibrate']],
    ['ninebox', 'Matriz 9-box', ['read', 'update']],
    ['feedback', 'Feedback continuo', ['read', 'create']],
    ['oneonone', 'Reuniones 1:1', ['read', 'create', 'update']],
    ['developmentplan', 'Planes de desarrollo (PDI)', ['read', 'create', 'update']],
    ['career', 'Rutas de carrera', ['manage']],
    ['succession', 'Planes de sucesion', ['read', 'manage']],
  ]),

  ...build(MODULES.COMMUNICATION, [
    ['post', 'Publicaciones del muro', [...CRUD, 'moderate']],
    ['event', 'Eventos', CRUD],
    ['recognition', 'Reconocimientos', ['read', 'create', 'delete']],
    ['value', 'Valores corporativos', ['manage']],
    ['badge', 'Insignias', ['manage']],
    ['benefit', 'Beneficios', CRUD],
    ['wiki', 'Wiki y base de conocimiento', CRUD],
  ]),

  ...build(MODULES.SURVEYS, [
    ['survey', 'Encuestas', [...CRUD, 'publish']],
    ['result', 'Resultados y analisis', ['read', 'export']],
    ['response', 'Respuestas', ['submit']],
    ['template', 'Plantillas de encuesta', ['manage']],
  ]),

  ...build(MODULES.ETHICS, [
    ['report', 'Denuncias recibidas', ['read', 'triage'], true],
    ['case', 'Casos de investigacion', ['read', 'create', 'update', 'close'], true],
    ['evidence', 'Evidencias', ['read', 'create'], true],
    ['stats', 'Estadisticas agregadas', ['read']],
    ['category', 'Categorias del canal', ['manage']],
  ]),

  ...build(MODULES.DOCUMENTS, [
    ['template', 'Plantillas de documentos', CRUD],
    ['generated', 'Documentos generados', ['read', 'create']],
    ['policy', 'Politicas y reglamentos', ['read', 'create', 'update', 'publish']],
    ['acknowledgement', 'Acuses de lectura', ['read']],
    ['signature', 'Solicitudes de firma', ['read', 'request']],
    ['certificate', 'Certificado laboral de autoservicio', ['create']],
  ]),

  ...build(MODULES.HELPDESK, [
    ['ticket', 'Tickets', ['read', 'create', 'update', 'assign', 'close']],
    ['category', 'Categorias de ticket', ['manage']],
    ['macro', 'Macros de respuesta', ['manage']],
    ['kb', 'Base de conocimiento', CRUD],
    ['sla', 'Politicas de SLA', ['manage']],
    ['channel', 'Canales conectados', ['manage']],
  ]),

  ...build(MODULES.SST, [
    ['medicalexam', 'Examenes medicos ocupacionales', ['read', 'create', 'update'], true],
    ['accident', 'Accidentes e incidentes', ['read', 'create', 'update']],
    ['risk', 'Matriz de riesgos', ['manage']],
    ['ppe', 'Entrega de EPP', ['read', 'create']],
    ['inspection', 'Inspecciones SST', ['read', 'create', 'update']],
    ['committee', 'Comites (COPASST, convivencia)', ['manage']],
    ['indicator', 'Indicadores Resolucion 0312', ['read']],
  ]),

  ...build(MODULES.ANALYTICS, [
    ['dashboard', 'Dashboards analiticos', ['read']],
    ['report', 'Constructor de reportes', [...CRUD, 'run']],
    ['schedule', 'Programacion de reportes', ['manage']],
    ['alert', 'Alertas y predicciones', ['read', 'manage']],
    ['export', 'Exportacion de datos', ['execute']],
  ]),

  // Transversal approval inbox, shared by every module that uses the workflow engine.
  {
    code: 'workflow.instance.read',
    module: MODULES.SETTINGS,
    resource: 'instance',
    action: 'read',
    label: 'Bandeja de aprobaciones - Ver',
  },
  {
    code: 'workflow.instance.approve',
    module: MODULES.SETTINGS,
    resource: 'instance',
    action: 'approve',
    label: 'Bandeja de aprobaciones - Aprobar o rechazar',
  },
  {
    code: 'workflow.instance.delegate',
    module: MODULES.SETTINGS,
    resource: 'instance',
    action: 'delegate',
    label: 'Bandeja de aprobaciones - Delegar',
  },
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((p) => p.code);

export const SENSITIVE_PERMISSION_CODES = PERMISSION_CATALOG.filter((p) => p.sensitive).map(
  (p) => p.code,
);

export function permissionsByModule(): Record<string, PermissionDefinition[]> {
  return PERMISSION_CATALOG.reduce<Record<string, PermissionDefinition[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});
}

/**
 * `a.b.c` matches exactly, `a.b.*` matches every action of that resource, and a
 * trailing `*` covers everything below the prefix, so `people.*` grants every
 * permission of the module.
 */
function patternToRegExp(pattern: string): RegExp {
  const segments = pattern.split('.');
  const body = segments
    .map((segment, index) => {
      if (segment !== '*') return segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      return index === segments.length - 1 ? '.+' : '[^.]+';
    })
    .join('\\.');
  return new RegExp('^' + body + '$');
}

/**
 * Expands patterns such as `people.*`, `leaves.request.*` or `*` into concrete
 * permission codes taken from the catalog.
 */
export function expandPermissionPatterns(patterns: string[]): string[] {
  const out = new Set<string>();
  for (const pattern of patterns) {
    if (pattern === '*') {
      PERMISSION_CODES.forEach((c) => out.add(c));
      continue;
    }
    if (!pattern.includes('*')) {
      out.add(pattern);
      continue;
    }
    const rx = patternToRegExp(pattern);
    PERMISSION_CODES.filter((c) => rx.test(c)).forEach((c) => out.add(c));
  }
  return [...out];
}

/** True when `granted` (which may contain wildcards) satisfies `required`. */
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === required || granted === '*') return true;
  if (!granted.includes('*')) return false;
  return patternToRegExp(granted).test(required);
}
