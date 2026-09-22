import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  CATALOG_KEYS,
  DEFAULT_EMBED_PROVIDERS,
  MODULE_CATALOG,
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  colombianHolidays,
  expandPermissionPatterns,
  fromDateKey,
  slugify,
} from '@talento/shared';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

/** Loads the permission and module catalogs. Idempotent. */
export async function syncCatalogs(prisma: PrismaClient): Promise<void> {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        module: permission.module,
        resource: permission.resource,
        action: permission.action,
        label: permission.label,
        isSensitive: Boolean(permission.sensitive),
      },
      update: { label: permission.label, isSensitive: Boolean(permission.sensitive) },
    });
  }

  for (const module of MODULE_CATALOG) {
    await prisma.appModule.upsert({
      where: { key: module.key },
      create: {
        key: module.key,
        name: module.labelKey.split('.').pop() ?? module.key,
        icon: module.icon,
        path: module.path,
        position: module.order,
        isCore: Boolean(module.core),
      },
      update: { icon: module.icon, path: module.path, position: module.order },
    });
  }
}

/** Creates the system roles of a company with their permissions and modules. */
export async function createSystemRoles(prisma: PrismaClient, companyId: string): Promise<void> {
  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const modules = await prisma.appModule.findMany({ select: { id: true, key: true } });
  const moduleByKey = new Map(modules.map((m) => [m.key, m.id]));

  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    if (definition.platform) continue;

    const role = await prisma.role.upsert({
      where: { companyId_key: { companyId, key: definition.key } },
      create: {
        companyId,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
        isSystem: true,
      },
      update: { name: definition.name, description: definition.description, scope: definition.scope },
    });

    const codes = expandPermissionPatterns(definition.permissions);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rows = codes
      .map((code) => permissionByCode.get(code))
      .filter(Boolean)
      .map((permissionId) => ({ roleId: role.id, permissionId: permissionId as string, scope: definition.scope }));
    if (rows.length) await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });

    await prisma.roleModule.deleteMany({ where: { roleId: role.id } });
    const moduleRows = definition.modules
      .map((key) => moduleByKey.get(key))
      .filter(Boolean)
      .map((moduleId) => ({ roleId: role.id, moduleId: moduleId as string, isVisible: true }));
    if (moduleRows.length) await prisma.roleModule.createMany({ data: moduleRows, skipDuplicates: true });
  }
}

/** Enables every module for a company. */
export async function enableModules(prisma: PrismaClient, companyId: string): Promise<void> {
  const modules = await prisma.appModule.findMany();
  for (const module of modules) {
    await prisma.companyModule.upsert({
      where: { companyId_moduleId: { companyId, moduleId: module.id } },
      create: { companyId, moduleId: module.id, isEnabled: true },
      update: { isEnabled: true },
    });
  }
}

const CATALOG_SEED: Record<string, Array<{ code: string; label: string }>> = {
  [CATALOG_KEYS.CONTRACT_TYPE]: [
    { code: 'indefinido', label: 'Termino indefinido' },
    { code: 'fijo', label: 'Termino fijo' },
    { code: 'obra_labor', label: 'Obra o labor' },
    { code: 'aprendizaje', label: 'Contrato de aprendizaje' },
    { code: 'prestacion_servicios', label: 'Prestacion de servicios' },
    { code: 'practicas', label: 'Practicas universitarias' },
  ],
  [CATALOG_KEYS.MOVEMENT_TYPE]: [
    { code: 'promocion', label: 'Promocion' },
    { code: 'traslado', label: 'Traslado de area' },
    { code: 'cambio_jefe', label: 'Cambio de jefe' },
    { code: 'cambio_sede', label: 'Cambio de sede' },
    { code: 'cambio_modalidad', label: 'Cambio de modalidad' },
    { code: 'cambio_cargo', label: 'Cambio de cargo' },
  ],
  [CATALOG_KEYS.EXIT_REASON]: [
    { code: 'renuncia', label: 'Renuncia voluntaria' },
    { code: 'terminacion', label: 'Terminacion por el empleador' },
    { code: 'fin_contrato', label: 'Vencimiento del contrato' },
    { code: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
    { code: 'jubilacion', label: 'Jubilacion' },
    { code: 'fallecimiento', label: 'Fallecimiento' },
  ],
  [CATALOG_KEYS.REJECTION_REASON]: [
    { code: 'perfil_no_ajusta', label: 'El perfil no se ajusta' },
    { code: 'expectativa_salarial', label: 'Expectativa salarial fuera de rango' },
    { code: 'desistio', label: 'El candidato desistio' },
    { code: 'no_asistio', label: 'No asistio a la entrevista' },
    { code: 'otro_candidato', label: 'Se selecciono otro candidato' },
    { code: 'referencias', label: 'Referencias desfavorables' },
  ],
  [CATALOG_KEYS.CANDIDATE_SOURCE]: [
    { code: 'portal', label: 'Portal de empleo' },
    { code: 'referido', label: 'Referido interno' },
    { code: 'linkedin', label: 'LinkedIn' },
    { code: 'computrabajo', label: 'Computrabajo' },
    { code: 'manual', label: 'Carga manual' },
    { code: 'universidad', label: 'Convenio universitario' },
  ],
  [CATALOG_KEYS.REQUISITION_REASON]: [
    { code: 'nuevo_cargo', label: 'Nuevo cargo' },
    { code: 'reemplazo', label: 'Reemplazo' },
    { code: 'temporal', label: 'Necesidad temporal' },
    { code: 'crecimiento', label: 'Crecimiento del area' },
  ],
  [CATALOG_KEYS.EVENT_TYPE]: [
    { code: 'incapacidad_prolongada', label: 'Incapacidad prolongada' },
    { code: 'horas_extra', label: 'Horas extra reportadas (informativo)' },
    { code: 'prestamo_equipo', label: 'Prestamo de equipo' },
    { code: 'sancion', label: 'Sancion' },
    { code: 'felicitacion', label: 'Felicitacion' },
    { code: 'comision', label: 'Comision de servicios' },
    { code: 'cambio_datos', label: 'Cambio de datos' },
  ],
  [CATALOG_KEYS.ASSET_TYPE]: [
    { code: 'laptop', label: 'Portatil' },
    { code: 'celular', label: 'Celular' },
    { code: 'monitor', label: 'Monitor' },
    { code: 'dotacion', label: 'Dotacion' },
    { code: 'llaves', label: 'Llaves y accesos' },
    { code: 'tarjeta', label: 'Tarjeta corporativa' },
  ],
  [CATALOG_KEYS.MARITAL_STATUS]: [
    { code: 'soltero', label: 'Soltero(a)' },
    { code: 'casado', label: 'Casado(a)' },
    { code: 'union_libre', label: 'Union libre' },
    { code: 'divorciado', label: 'Divorciado(a)' },
    { code: 'viudo', label: 'Viudo(a)' },
  ],
  [CATALOG_KEYS.RELATIONSHIP]: [
    { code: 'conyuge', label: 'Conyuge' },
    { code: 'hijo', label: 'Hijo(a)' },
    { code: 'padre', label: 'Padre' },
    { code: 'madre', label: 'Madre' },
    { code: 'hermano', label: 'Hermano(a)' },
    { code: 'otro', label: 'Otro' },
  ],
  [CATALOG_KEYS.BLOOD_TYPE]: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => ({
    code: t.toLowerCase().replace('+', '_pos').replace('-', '_neg'),
    label: t,
  })),
  [CATALOG_KEYS.EDUCATION_LEVEL]: [
    { code: 'bachiller', label: 'Bachiller' },
    { code: 'tecnico', label: 'Tecnico' },
    { code: 'tecnologo', label: 'Tecnologo' },
    { code: 'profesional', label: 'Profesional' },
    { code: 'especializacion', label: 'Especializacion' },
    { code: 'maestria', label: 'Maestria' },
    { code: 'doctorado', label: 'Doctorado' },
  ],
  [CATALOG_KEYS.DISCIPLINARY_TYPE]: [
    { code: 'llamado_verbal', label: 'Llamado de atencion verbal' },
    { code: 'llamado_escrito', label: 'Llamado de atencion escrito' },
    { code: 'descargos', label: 'Diligencia de descargos' },
    { code: 'suspension', label: 'Suspension' },
  ],
  [CATALOG_KEYS.TICKET_CATEGORY]: [
    { code: 'certificados', label: 'Certificados' },
    { code: 'vacaciones', label: 'Vacaciones y permisos' },
    { code: 'datos', label: 'Actualizacion de datos' },
    { code: 'ti', label: 'Tecnologia' },
    { code: 'beneficios', label: 'Beneficios' },
    { code: 'nomina', label: 'Nomina (redireccion)' },
    { code: 'otro', label: 'Otro' },
  ],
  [CATALOG_KEYS.PPE_TYPE]: [
    { code: 'casco', label: 'Casco de seguridad' },
    { code: 'guantes', label: 'Guantes' },
    { code: 'botas', label: 'Botas de seguridad' },
    { code: 'gafas', label: 'Gafas de proteccion' },
    { code: 'arnes', label: 'Arnes' },
    { code: 'tapabocas', label: 'Proteccion respiratoria' },
  ],
  [CATALOG_KEYS.EPS]: [
    { code: 'sura', label: 'EPS SURA' },
    { code: 'sanitas', label: 'EPS Sanitas' },
    { code: 'compensar', label: 'Compensar EPS' },
    { code: 'nueva_eps', label: 'Nueva EPS' },
    { code: 'salud_total', label: 'Salud Total' },
    { code: 'coosalud', label: 'Coosalud' },
  ],
  [CATALOG_KEYS.ARL]: [
    { code: 'sura', label: 'ARL SURA' },
    { code: 'positiva', label: 'Positiva' },
    { code: 'colmena', label: 'Colmena Seguros' },
    { code: 'bolivar', label: 'Seguros Bolivar' },
  ],
  [CATALOG_KEYS.PENSION_FUND]: [
    { code: 'porvenir', label: 'Porvenir' },
    { code: 'proteccion', label: 'Proteccion' },
    { code: 'colfondos', label: 'Colfondos' },
    { code: 'skandia', label: 'Skandia' },
    { code: 'colpensiones', label: 'Colpensiones' },
  ],
};

export async function seedCatalogs(prisma: PrismaClient, companyId: string): Promise<void> {
  for (const [catalogKey, items] of Object.entries(CATALOG_SEED)) {
    for (const [index, item] of items.entries()) {
      await prisma.catalogItem.upsert({
        where: { companyId_catalogKey_code: { companyId, catalogKey, code: item.code } },
        create: {
          companyId,
          catalogKey,
          code: item.code,
          label: item.label,
          position: index,
          isSystem: true,
        },
        update: { label: item.label, position: index },
      });
    }
  }
}

/** Colombian absence types with their business rules. */
const LEAVE_TYPES = [
  {
    code: 'vacaciones',
    name: 'Vacaciones',
    color: '#0ea5e9',
    affectsBalance: true,
    countsBusinessDays: true,
    minNoticeDays: 15,
    maxDaysPerRequest: 30,
    requiresApproval: true,
    isPaid: true,
    payrollCode: 'VAC',
  },
  {
    code: 'permiso_remunerado',
    name: 'Permiso remunerado',
    color: '#22c55e',
    requiresApproval: true,
    countsBusinessDays: true,
    maxDaysPerRequest: 5,
    isPaid: true,
    payrollCode: 'PR',
  },
  {
    code: 'permiso_no_remunerado',
    name: 'Permiso no remunerado',
    color: '#f97316',
    requiresApproval: true,
    countsBusinessDays: true,
    isPaid: false,
    payrollCode: 'PNR',
  },
  {
    code: 'incapacidad_eps',
    name: 'Incapacidad por enfermedad general (EPS)',
    color: '#ef4444',
    requiresApproval: false,
    requiresAttachment: true,
    countsBusinessDays: false,
    isPaid: true,
    payrollCode: 'INC_EPS',
  },
  {
    code: 'incapacidad_arl',
    name: 'Incapacidad por accidente laboral (ARL)',
    color: '#dc2626',
    requiresApproval: false,
    requiresAttachment: true,
    countsBusinessDays: false,
    isPaid: true,
    payrollCode: 'INC_ARL',
  },
  {
    code: 'licencia_maternidad',
    name: 'Licencia de maternidad',
    color: '#ec4899',
    requiresApproval: true,
    requiresAttachment: true,
    countsBusinessDays: false,
    isPaid: true,
    payrollCode: 'LMAT',
  },
  {
    code: 'licencia_paternidad',
    name: 'Licencia de paternidad',
    color: '#8b5cf6',
    requiresApproval: true,
    requiresAttachment: true,
    countsBusinessDays: false,
    isPaid: true,
    payrollCode: 'LPAT',
  },
  {
    code: 'luto',
    name: 'Licencia por luto',
    color: '#64748b',
    requiresApproval: true,
    countsBusinessDays: false,
    maxDaysPerRequest: 5,
    isPaid: true,
    payrollCode: 'LUTO',
  },
  {
    code: 'calamidad',
    name: 'Calamidad domestica',
    color: '#a855f7',
    requiresApproval: true,
    countsBusinessDays: true,
    maxDaysPerRequest: 3,
    isPaid: true,
    payrollCode: 'CAL',
  },
  {
    code: 'dia_cumpleanos',
    name: 'Dia de cumpleanos',
    color: '#f59e0b',
    requiresApproval: true,
    countsBusinessDays: true,
    maxDaysPerRequest: 1,
    isPaid: true,
  },
  {
    code: 'teletrabajo',
    name: 'Teletrabajo',
    color: '#14b8a6',
    requiresApproval: true,
    countsBusinessDays: true,
    isPaid: true,
  },
  {
    code: 'compensatorio',
    name: 'Dia compensatorio',
    color: '#06b6d4',
    requiresApproval: true,
    countsBusinessDays: true,
    maxDaysPerRequest: 2,
    isPaid: true,
  },
  {
    code: 'capacitacion',
    name: 'Capacitacion',
    color: '#6366f1',
    requiresApproval: true,
    countsBusinessDays: true,
    isPaid: true,
  },
  {
    code: 'comision',
    name: 'Comision de servicios',
    color: '#3b82f6',
    requiresApproval: true,
    countsBusinessDays: true,
    isPaid: true,
  },
];

export async function seedLeaveTypes(prisma: PrismaClient, companyId: string): Promise<void> {
  for (const type of LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId, code: type.code } },
      create: {
        companyId,
        code: type.code,
        name: type.name,
        color: type.color,
        requiresApproval: type.requiresApproval ?? true,
        requiresAttachment: type.requiresAttachment ?? false,
        affectsBalance: type.affectsBalance ?? false,
        countsBusinessDays: type.countsBusinessDays ?? true,
        maxDaysPerRequest: type.maxDaysPerRequest ?? null,
        minNoticeDays: type.minNoticeDays ?? 0,
        isPaid: type.isPaid ?? true,
        payrollCode: type.payrollCode ?? null,
        isSystem: true,
      },
      update: { name: type.name, color: type.color },
    });
  }

  const existingPolicy = await prisma.leavePolicy.findFirst({ where: { companyId, isDefault: true } });
  if (!existingPolicy) {
    await prisma.leavePolicy.create({
      data: {
        companyId,
        name: 'Politica legal Colombia (15 dias habiles por ano)',
        daysPerYear: 15,
        accrualMode: 'monthly',
        countsBusinessDays: true,
        alertThresholdDays: 30,
        isDefault: true,
      },
    });
  }
}

export async function seedHolidays(
  prisma: PrismaClient,
  companyId: string,
  years: number[],
): Promise<number> {
  let created = 0;
  for (const year of years) {
    for (const holiday of colombianHolidays(year)) {
      const date = fromDateKey(holiday.date);
      const exists = await prisma.holiday.findFirst({ where: { companyId, date, locationId: null } });
      if (exists) continue;
      await prisma.holiday.create({
        data: { companyId, date, name: holiday.name, country: 'CO' },
      });
      created += 1;
    }
  }
  return created;
}

const DOCUMENT_TYPES = [
  { code: 'contrato', name: 'Contrato de trabajo', isRequired: true },
  { code: 'cedula', name: 'Documento de identidad', isRequired: true },
  { code: 'hoja_vida', name: 'Hoja de vida', isRequired: true },
  { code: 'certificado_estudios', name: 'Certificados de estudio', isRequired: false },
  { code: 'certificado_laboral', name: 'Certificados laborales anteriores', isRequired: false },
  { code: 'afiliacion_eps', name: 'Afiliacion EPS', isRequired: true },
  { code: 'afiliacion_pension', name: 'Afiliacion fondo de pensiones', isRequired: true },
  { code: 'afiliacion_arl', name: 'Afiliacion ARL', isRequired: true },
  {
    code: 'examen_ingreso',
    name: 'Examen medico de ingreso',
    isRequired: true,
    isSensitive: true,
  },
  { code: 'licencia_conduccion', name: 'Licencia de conduccion', hasExpiration: true },
  { code: 'certificado_alturas', name: 'Certificado de trabajo en alturas', hasExpiration: true },
  { code: 'acta_entrega', name: 'Acta de entrega de elementos', isRequired: false },
  { code: 'memorando', name: 'Memorando', visibleToEmployee: true, isSensitive: true },
];

export async function seedDocumentTypes(prisma: PrismaClient, companyId: string): Promise<void> {
  for (const [index, type] of DOCUMENT_TYPES.entries()) {
    await prisma.documentType.upsert({
      where: { companyId_code: { companyId, code: type.code } },
      create: {
        companyId,
        code: type.code,
        name: type.name,
        isRequired: type.isRequired ?? false,
        hasExpiration: type.hasExpiration ?? false,
        isSensitive: type.isSensitive ?? false,
        visibleToEmployee: type.visibleToEmployee ?? true,
        position: index,
      },
      update: { name: type.name },
    });
  }
}

export async function seedEthicsCategories(prisma: PrismaClient, companyId: string): Promise<void> {
  const categories = [
    { name: 'Acoso laboral', slaDays: 15, defaultSeverity: 'high' as const },
    { name: 'Acoso sexual', slaDays: 10, defaultSeverity: 'critical' as const },
    { name: 'Discriminacion', slaDays: 15, defaultSeverity: 'high' as const },
    { name: 'Fraude o corrupcion', slaDays: 20, defaultSeverity: 'critical' as const },
    { name: 'Conflicto de interes', slaDays: 20, defaultSeverity: 'medium' as const },
    { name: 'Seguridad y salud', slaDays: 10, defaultSeverity: 'high' as const },
    { name: 'Otro', slaDays: 30, defaultSeverity: 'low' as const },
  ];
  for (const [index, category] of categories.entries()) {
    await prisma.ethicsCategory.upsert({
      where: { companyId_name: { companyId, name: category.name } },
      create: {
        companyId,
        name: category.name,
        slaDays: category.slaDays,
        defaultSeverity: category.defaultSeverity,
        position: index,
      },
      update: { slaDays: category.slaDays },
    });
  }
}

export async function seedEmbedProviders(prisma: PrismaClient, companyId: string): Promise<void> {
  for (const provider of DEFAULT_EMBED_PROVIDERS) {
    await prisma.embedProvider.upsert({
      where: { companyId_domain: { companyId, domain: provider.domain } },
      create: {
        companyId,
        name: provider.name,
        domain: provider.domain,
        oembedUrl: provider.oembed,
        isActive: true,
      },
      update: { oembedUrl: provider.oembed },
    });
  }
}

/** Default approval flows: leaves, requisitions and personnel movements. */
export async function seedWorkflows(prisma: PrismaClient, companyId: string): Promise<void> {
  const hrRole = await prisma.role.findFirst({ where: { companyId, key: 'hr_admin' } });

  const definitions = [
    {
      key: 'leave_request_default',
      name: 'Aprobacion de ausencias',
      entityType: 'leave_request',
      steps: [
        { name: 'Jefe directo', approverType: 'direct_manager' as const, condition: {} },
        {
          name: 'Talento Humano (mas de 10 dias)',
          approverType: 'hr' as const,
          condition: { field: 'days', op: 'gt', value: 10 },
        },
      ],
    },
    {
      key: 'job_requisition_default',
      name: 'Aprobacion de requisiciones',
      entityType: 'job_requisition',
      steps: [
        { name: 'Talento Humano valida', approverType: 'hr' as const, condition: {} },
        { name: 'Gerencia aprueba', approverType: 'manager_of_manager' as const, condition: {} },
      ],
    },
    {
      key: 'employee_movement_default',
      name: 'Aprobacion de movimientos de personal',
      entityType: 'employee_movement',
      steps: [
        { name: 'Jefe directo', approverType: 'direct_manager' as const, condition: {} },
        { name: 'Talento Humano', approverType: 'hr' as const, condition: {} },
      ],
    },
  ];

  for (const definition of definitions) {
    const existing = await prisma.workflowDefinition.findFirst({
      where: { companyId, key: definition.key },
    });
    if (existing) continue;

    const created = await prisma.workflowDefinition.create({
      data: {
        companyId,
        key: definition.key,
        name: definition.name,
        entityType: definition.entityType,
        isActive: true,
      },
    });
    for (const [index, step] of definition.steps.entries()) {
      await prisma.workflowStep.create({
        data: {
          companyId,
          definitionId: created.id,
          position: index,
          name: step.name,
          approverType: step.approverType,
          approverRoleId: step.approverType === 'hr' ? (hrRole?.id ?? null) : null,
          condition: step.condition as Prisma.InputJsonValue,
          slaHours: 48,
        },
      });
    }
  }
}

export async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  const templates = [
    {
      eventKey: 'workflow.step_pending',
      subject: 'Aprobacion pendiente: {{title}}',
      body: '<p>Hola {{firstName}},</p><p>Tiene una solicitud pendiente de aprobacion: <strong>{{title}}</strong>.</p><p>{{body}}</p>',
    },
    {
      eventKey: 'leave.approved',
      subject: 'Su solicitud de ausencia fue aprobada',
      body: '<p>Hola {{firstName}},</p><p>{{title}}</p><p>{{body}}</p>',
    },
    {
      eventKey: 'leave.rejected',
      subject: 'Su solicitud de ausencia fue rechazada',
      body: '<p>Hola {{firstName}},</p><p>{{title}}</p><p>{{body}}</p>',
    },
    {
      eventKey: 'onboarding.started',
      subject: 'Bienvenido a {{companyName}}',
      body: '<p>Hola {{firstName}},</p><p>Su proceso de ingreso ya esta disponible en el portal.</p>',
    },
    {
      eventKey: 'survey.published',
      subject: 'Nueva encuesta: {{title}}',
      body: '<p>Hola {{firstName}},</p><p>{{body}}</p><p>Su opinion es confidencial y muy importante.</p>',
    },
    {
      eventKey: 'recognition.given',
      subject: 'Recibio un reconocimiento',
      body: '<p>Hola {{firstName}},</p><p>{{body}}</p>',
    },
    {
      eventKey: 'post.published',
      subject: '{{title}}',
      body: '<p>Hola {{firstName}},</p><p>{{body}}</p>',
    },
    {
      eventKey: 'ticket.assigned',
      subject: 'Nuevo ticket asignado',
      body: '<p>Hola {{firstName}},</p><p>{{title}}</p>',
    },
  ];

  for (const template of templates) {
    const exists = await prisma.notificationTemplate.findFirst({
      where: { companyId: null, eventKey: template.eventKey, channel: 'email', locale: 'es' },
    });
    if (exists) continue;
    await prisma.notificationTemplate.create({
      data: {
        companyId: null,
        eventKey: template.eventKey,
        channel: 'email',
        locale: 'es',
        subject: template.subject,
        body: template.body,
      },
    });
  }
}

export async function seedSurveyTemplates(prisma: PrismaClient): Promise<void> {
  const templates = [
    {
      key: 'clima_laboral',
      name: 'Clima laboral',
      kind: 'climate',
      schema: {
        title: 'Encuesta de clima laboral',
        description: 'Sus respuestas son anonimas y se analizan de forma agregada.',
        fields: [
          {
            key: 'liderazgo',
            type: 'likert',
            label: 'Mi jefe directo me brinda apoyo y retroalimentacion oportuna',
            dimension: 'Liderazgo',
            required: true,
            scaleLabels: ['Muy en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Muy de acuerdo'],
          },
          {
            key: 'reconocimiento',
            type: 'likert',
            label: 'Recibo reconocimiento por el trabajo que realizo',
            dimension: 'Reconocimiento',
            required: true,
          },
          {
            key: 'desarrollo',
            type: 'likert',
            label: 'Tengo oportunidades de desarrollo profesional',
            dimension: 'Desarrollo',
            required: true,
          },
          {
            key: 'equilibrio',
            type: 'likert',
            label: 'Puedo equilibrar mi vida laboral y personal',
            dimension: 'Equilibrio',
            required: true,
          },
          {
            key: 'comunicacion',
            type: 'likert',
            label: 'La comunicacion en la empresa es clara y oportuna',
            dimension: 'Comunicacion',
            required: true,
          },
          {
            key: 'herramientas',
            type: 'likert',
            label: 'Cuento con las herramientas necesarias para hacer mi trabajo',
            dimension: 'Recursos',
            required: true,
          },
          {
            key: 'comentarios',
            type: 'textarea',
            label: 'Que cambiaria para mejorar su experiencia en la empresa?',
          },
        ],
      },
    },
    {
      key: 'enps',
      name: 'eNPS trimestral',
      kind: 'enps',
      schema: {
        title: 'Recomendaria a un amigo trabajar aqui?',
        fields: [
          {
            key: 'enps',
            type: 'nps',
            label: 'De 0 a 10, que tan probable es que recomiende a la empresa como lugar para trabajar?',
            min: 0,
            max: 10,
            required: true,
          },
          { key: 'motivo', type: 'textarea', label: 'Cual es la razon principal de su calificacion?' },
        ],
      },
    },
    {
      key: 'satisfaccion_ingreso',
      name: 'Experiencia de ingreso',
      kind: 'onboarding',
      schema: {
        title: 'Como fue su proceso de ingreso?',
        fields: [
          { key: 'claridad', type: 'likert', label: 'La informacion previa a mi ingreso fue clara', dimension: 'Onboarding' },
          { key: 'acompanamiento', type: 'likert', label: 'Recibi acompanamiento en mis primeros dias', dimension: 'Onboarding' },
          { key: 'herramientas', type: 'likert', label: 'Tuve mis herramientas de trabajo a tiempo', dimension: 'Onboarding' },
          { key: 'sugerencias', type: 'textarea', label: 'Que podriamos mejorar del proceso de ingreso?' },
        ],
      },
    },
    {
      key: 'entrevista_retiro',
      name: 'Entrevista de retiro',
      kind: 'exit',
      schema: {
        title: 'Entrevista de retiro',
        fields: [
          {
            key: 'motivo',
            type: 'select',
            label: 'Motivo principal de su salida',
            required: true,
            options: [
              { value: 'salario', label: 'Compensacion' },
              { value: 'desarrollo', label: 'Falta de desarrollo' },
              { value: 'jefe', label: 'Relacion con el jefe' },
              { value: 'clima', label: 'Clima laboral' },
              { value: 'personal', label: 'Motivos personales' },
              { value: 'otro', label: 'Otro' },
            ],
          },
          { key: 'recomendaria', type: 'nps', label: 'Recomendaria la empresa a otros?', min: 0, max: 10 },
          { key: 'mejoras', type: 'textarea', label: 'Que deberiamos mejorar?' },
        ],
      },
    },
  ];

  for (const template of templates) {
    const exists = await prisma.surveyTemplate.findFirst({
      where: { companyId: null, key: template.key },
    });
    if (exists) continue;
    await prisma.surveyTemplate.create({
      data: {
        companyId: null,
        key: template.key,
        name: template.name,
        kind: template.kind,
        schema: template.schema as Prisma.InputJsonValue,
      },
    });
  }
}

export async function seedDocumentTemplates(prisma: PrismaClient, companyId: string): Promise<void> {
  const templates = [
    {
      code: 'certificado_laboral',
      name: 'Certificado laboral',
      kind: 'certificate',
      isSelfService: true,
      bodyHtml: `<p>{{company.legal_name}}, identificada con NIT {{company.tax_id}},</p>
<h3>CERTIFICA</h3>
<p>Que <strong>{{employee.full_name}}</strong>, identificado(a) con {{employee.document_type}} No. {{employee.document_number}},
labora en nuestra empresa desde el {{employee.hired_at}}, desempenando el cargo de <strong>{{position.name}}</strong>
en el area de {{department.name}}, mediante contrato a {{contract.type}}.</p>
<p>Se expide en {{company.city}} el {{today}} a solicitud del interesado.</p>
<p>&nbsp;</p>
<p>_____________________________<br/>Direccion de Talento Humano<br/>{{company.name}}</p>`,
    },
    {
      code: 'carta_oferta',
      name: 'Carta de oferta laboral',
      kind: 'letter',
      bodyHtml: `<p>{{company.city}}, {{today}}</p>
<p>Senor(a) <strong>{{employee.full_name}}</strong></p>
<p>Nos complace ofrecerle el cargo de <strong>{{position.name}}</strong> en {{company.name}},
en el area de {{department.name}}, con fecha de inicio {{contract.start_date}} y contrato a {{contract.type}}.</p>
<p>Quedamos atentos a su confirmacion.</p>
<p>Cordialmente,<br/>Talento Humano</p>`,
    },
    {
      code: 'acta_entrega_equipo',
      name: 'Acta de entrega de elementos',
      kind: 'act',
      requiresSignature: true,
      bodyHtml: `<p>ACTA DE ENTREGA DE ELEMENTOS DE TRABAJO</p>
<p>En {{company.city}}, el {{today}}, se hace entrega a <strong>{{employee.full_name}}</strong>
({{employee.document_type}} {{employee.document_number}}), quien desempena el cargo de {{position.name}},
de los elementos relacionados a continuacion.</p>
<p>El colaborador se compromete a su buen uso y a devolverlos al finalizar su vinculacion.</p>`,
    },
    {
      code: 'llamado_atencion',
      name: 'Llamado de atencion escrito',
      kind: 'memo',
      bodyHtml: `<p>{{company.city}}, {{today}}</p>
<p>Senor(a) <strong>{{employee.full_name}}</strong><br/>{{position.name}}</p>
<p>Por medio de la presente se le hace un llamado de atencion escrito por los hechos descritos a continuacion,
de conformidad con el reglamento interno de trabajo.</p>`,
    },
  ];

  for (const template of templates) {
    await prisma.documentTemplate.upsert({
      where: { companyId_code: { companyId, code: template.code } },
      create: {
        companyId,
        code: template.code,
        name: template.name,
        kind: template.kind,
        bodyHtml: template.bodyHtml,
        isSelfService: template.isSelfService ?? false,
        requiresSignature: template.requiresSignature ?? false,
        variables: [
          'company.name',
          'company.legal_name',
          'company.tax_id',
          'company.city',
          'employee.full_name',
          'employee.document_type',
          'employee.document_number',
          'employee.hired_at',
          'position.name',
          'department.name',
          'contract.type',
          'contract.start_date',
          'today',
        ],
      },
      update: { bodyHtml: template.bodyHtml, name: template.name },
    });
  }
}

export async function seedSlaAndTicketCategories(
  prisma: PrismaClient,
  companyId: string,
): Promise<void> {
  const sla = await prisma.slaPolicy.upsert({
    where: { companyId_name: { companyId, name: 'SLA estandar' } },
    create: {
      companyId,
      name: 'SLA estandar',
      firstResponseMinutes: 240,
      resolutionMinutes: 2880,
      isDefault: true,
    },
    update: {},
  });

  const categories = [
    { code: 'certificados', name: 'Certificados' },
    { code: 'vacaciones', name: 'Vacaciones y permisos' },
    { code: 'datos', name: 'Actualizacion de datos' },
    { code: 'ti', name: 'Tecnologia' },
    { code: 'beneficios', name: 'Beneficios' },
    { code: 'nomina', name: 'Nomina (redireccion)' },
    { code: 'otro', name: 'Otro' },
  ];
  for (const [index, category] of categories.entries()) {
    await prisma.ticketCategory.upsert({
      where: { companyId_code: { companyId, code: category.code } },
      create: {
        companyId,
        code: category.code,
        name: category.name,
        slaPolicyId: sla.id,
        position: index,
      },
      update: { name: category.name, slaPolicyId: sla.id },
    });
  }
}

export interface CompanyBootstrapInput {
  name: string;
  legalName?: string;
  slug?: string;
  taxId?: string;
  city?: string;
  address?: string;
  primaryColor?: string;
}

/** Creates a company with every default catalog a tenant needs to operate. */
export async function bootstrapCompany(
  prisma: PrismaClient,
  input: CompanyBootstrapInput,
): Promise<string> {
  const slug = input.slug ?? slugify(input.name);
  const company = await prisma.company.upsert({
    where: { slug },
    create: {
      name: input.name,
      legalName: input.legalName ?? input.name,
      slug,
      taxId: input.taxId ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      primaryColor: input.primaryColor ?? '#2563eb',
      country: 'CO',
      timezone: 'America/Bogota',
      locale: 'es',
      privacyPolicy:
        'Politica de tratamiento de datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.',
    },
    update: { name: input.name },
  });

  await enableModules(prisma, company.id);
  await createSystemRoles(prisma, company.id);
  await seedCatalogs(prisma, company.id);
  await seedLeaveTypes(prisma, company.id);
  await seedDocumentTypes(prisma, company.id);
  await seedEthicsCategories(prisma, company.id);
  await seedEmbedProviders(prisma, company.id);
  await seedWorkflows(prisma, company.id);
  await seedDocumentTemplates(prisma, company.id);
  await seedSlaAndTicketCategories(prisma, company.id);

  const currentYear = new Date().getUTCFullYear();
  await seedHolidays(prisma, company.id, [currentYear, currentYear + 1]);

  return company.id;
}

/** Creates (or updates) a user and attaches it to a company with roles. */
export async function upsertUser(
  prisma: PrismaClient,
  params: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    companyId?: string;
    roleKeys?: string[];
    isSuperadmin?: boolean;
    employeeId?: string;
  },
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: params.email.toLowerCase() },
    create: {
      email: params.email.toLowerCase(),
      firstName: params.firstName,
      lastName: params.lastName,
      passwordHash: await hashPassword(params.password),
      status: 'active',
      isSuperadmin: params.isSuperadmin ?? false,
      mustChangePassword: false,
    },
    update: {
      firstName: params.firstName,
      lastName: params.lastName,
      status: 'active',
      isSuperadmin: params.isSuperadmin ?? false,
    },
  });

  if (params.companyId) {
    const membership = await prisma.companyUser.upsert({
      where: { companyId_userId: { companyId: params.companyId, userId: user.id } },
      create: { companyId: params.companyId, userId: user.id, isActive: true, isDefault: true },
      update: { isActive: true },
    });

    if (params.roleKeys?.length) {
      const roles = await prisma.role.findMany({
        where: { companyId: params.companyId, key: { in: params.roleKeys } },
        select: { id: true },
      });
      await prisma.userRole.deleteMany({ where: { companyUserId: membership.id } });
      if (roles.length) {
        await prisma.userRole.createMany({
          data: roles.map((role) => ({ companyUserId: membership.id, roleId: role.id })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastCompanyId: params.companyId } });
  }

  if (params.employeeId) {
    await prisma.employee.update({ where: { id: params.employeeId }, data: { userId: user.id } });
  }

  return user.id;
}
