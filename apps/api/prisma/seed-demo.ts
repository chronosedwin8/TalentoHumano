/**
 * Demo environment: "Demo S.A.S." (Barranquilla) with a realistic data set
 * across every module, as described in the specification (section 10).
 *
 *   pnpm seed:demo
 *
 * The script is deterministic: the same run always produces the same company,
 * so screenshots, demos and end-to-end tests stay stable.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import {
  addDays,
  addMonths,
  colombianHolidays,
  countDays,
  fromDateKey,
  randomTrackingCode,
  slugify,
  toDateKey,
} from '@talento/shared';
import {
  bootstrapCompany,
  hashPassword,
  seedNotificationTemplates,
  seedSurveyTemplates,
  syncCatalogs,
  upsertUser,
} from './seed-helpers';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const DEMO_SLUG = 'demo';

/* -------------------------------------------------------------------------- */
/*  Deterministic helpers                                                      */
/* -------------------------------------------------------------------------- */

let seedState = 20260922;
function random(): number {
  // Mulberry32: small, fast and reproducible.
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const pickMany = <T>(items: T[], count: number): T[] => {
  const copy = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && copy.length; i += 1) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
};
const int = (min: number, max: number): number => Math.floor(random() * (max - min + 1)) + min;
const chance = (probability: number): boolean => random() < probability;

/** Same AES-256-GCM format the API uses, so encrypted demo data decrypts. */
function encrypt(value: string | number | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = process.env.ENCRYPTION_KEY ?? '';
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : createHash('sha256').update(raw, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return 'enc:v1:' + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

const FIRST_NAMES_M = ['Carlos', 'Andres', 'Juan', 'Luis', 'Miguel', 'Jorge', 'David', 'Ricardo', 'Fernando', 'Camilo', 'Santiago', 'Daniel', 'Oscar', 'Julian', 'Mauricio', 'Alejandro', 'Sebastian', 'Diego', 'Felipe', 'Esteban'];
const FIRST_NAMES_F = ['Maria', 'Ana', 'Laura', 'Carolina', 'Paula', 'Diana', 'Claudia', 'Sandra', 'Natalia', 'Valentina', 'Juliana', 'Catalina', 'Adriana', 'Monica', 'Patricia', 'Alejandra', 'Daniela', 'Gabriela', 'Lucia', 'Marcela'];
const LAST_NAMES = ['Ortiz', 'Herazo', 'Gomez', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Florez', 'Rivera', 'Diaz', 'Vargas', 'Castro', 'Rojas', 'Moreno', 'Munoz', 'Alvarez', 'Romero', 'Suarez', 'Navarro', 'Pacheco', 'Barrios', 'Cantillo', 'De la Hoz', 'Polo', 'Consuegra', 'Mendoza'];

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const started = Date.now();
  console.log('Preparando catalogos de plataforma...');
  await syncCatalogs(prisma);
  await seedNotificationTemplates(prisma);
  await seedSurveyTemplates(prisma);

  const existing = await prisma.company.findFirst({ where: { slug: DEMO_SLUG } });
  if (existing) {
    console.log('Eliminando la empresa demo anterior...');
    // Cascade does not reach every table; clean the tenant rows explicitly.
    await cleanCompany(existing.id);
    await prisma.company.delete({ where: { id: existing.id } });
    // Users live outside the tenant, so the demo accounts are removed by email.
    await prisma.user.deleteMany({ where: { email: { endsWith: '@demo.com' } } });
  }

  console.log('Creando Demo S.A.S. ...');
  const companyId = await bootstrapCompany(prisma, {
    name: 'Demo S.A.S.',
    legalName: 'Demo Soluciones Empresariales S.A.S.',
    slug: DEMO_SLUG,
    taxId: '901456789-1',
    city: 'Barranquilla',
    address: 'Carrera 53 No. 82-165, Oficina 701',
    primaryColor: '#1d4ed8',
  });

  const currentYear = new Date().getUTCFullYear();
  await seedHolidayYears(companyId, [currentYear - 1, currentYear, currentYear + 1]);

  const locations = await createLocations(companyId);
  const departments = await createDepartments(companyId);
  const costCenters = await createCostCenters(companyId);
  const positions = await createPositions(companyId, departments);
  const competencies = await createCompetencies(companyId, positions);
  const values = await createCompanyValues(companyId);

  const employees = await createEmployees(companyId, { locations, departments, positions, costCenters });
  console.log(`  ${employees.length} colaboradores creados`);

  const { demoEmployeeId } = await createDemoUsers(companyId, employees);
  await createApprovalFlows(companyId);
  await createDocuments(companyId, employees);
  await createAssets(companyId, employees, locations);
  await createSchedulesAndAttendance(companyId, employees);
  await createLeaves(companyId, employees, demoEmployeeId);
  await createRecruiting(companyId, { departments, positions, locations, employees, competencies });
  await createOnboarding(companyId, employees);
  await createLearning(companyId, employees, positions);
  await createPerformance(companyId, employees, competencies);
  await createCommunication(companyId, employees, values);
  await createSurveys(companyId, employees, departments, demoEmployeeId);
  await createEthics(companyId);
  await createHelpdesk(companyId, employees);
  await createSst(companyId, employees, locations, positions);
  await createSnapshots(companyId, employees);

  const summary = {
    sedes: await prisma.location.count({ where: { companyId } }),
    areas: await prisma.department.count({ where: { companyId } }),
    cargos: await prisma.position.count({ where: { companyId } }),
    colaboradores: await prisma.employee.count({ where: { companyId } }),
    contratos: await prisma.employmentContract.count({ where: { companyId } }),
    documentos: await prisma.employeeDocument.count({ where: { companyId } }),
    vacantes: await prisma.jobPosting.count({ where: { companyId } }),
    candidatos: await prisma.candidate.count({ where: { companyId } }),
    ausencias: await prisma.leaveRequest.count({ where: { companyId } }),
    asistencia: await prisma.attendanceDay.count({ where: { companyId } }),
    cursos: await prisma.course.count({ where: { companyId } }),
    inscripciones: await prisma.enrollment.count({ where: { companyId } }),
    objetivos: await prisma.objective.count({ where: { companyId } }),
    evaluaciones: await prisma.reviewAssignment.count({ where: { companyId } }),
    publicaciones: await prisma.post.count({ where: { companyId } }),
    reconocimientos: await prisma.recognition.count({ where: { companyId } }),
    encuestas: await prisma.survey.count({ where: { companyId } }),
    respuestas: await prisma.surveyResponse.count({ where: { companyId } }),
    denuncias: await prisma.ethicsReport.count({ where: { companyId } }),
    tickets: await prisma.ticket.count({ where: { companyId } }),
    snapshots: await prisma.hrSnapshot.count({ where: { companyId } }),
  };

  console.log('\nEntorno demo listo en', ((Date.now() - started) / 1000).toFixed(1), 's');
  console.table(summary);
  console.log('\nUsuarios demo (contrasena ' + DEMO_PASSWORD + '):');
  console.table([
    { usuario: 'admin@demo.com', rol: 'Administrador de empresa' },
    { usuario: 'hr@demo.com', rol: 'Administrador de Talento Humano' },
    { usuario: 'manager@demo.com', rol: 'Jefe de area' },
    { usuario: 'empleado@demo.com', rol: 'Colaborador' },
    { usuario: 'etica@demo.com', rol: 'Oficial de etica' },
  ]);
  console.log('\nPortales publicos:');
  console.log('  Empleos:    /careers/demo');
  console.log('  Denuncias:  /ethics/demo\n');
}

/* -------------------------------------------------------------------------- */
/*  Organisation                                                               */
/* -------------------------------------------------------------------------- */

async function cleanCompany(companyId: string): Promise<void> {
  const models = Prisma.dmmf.datamodel.models.filter(
    (model) =>
      model.name !== 'Company' && model.fields.some((field) => field.name === 'companyId'),
  );
  // Several passes: foreign keys between tenant tables make the first pass
  // fail for the children, and the next pass picks them up.
  for (let pass = 0; pass < 4; pass += 1) {
    for (const model of models) {
      const delegate = (prisma as unknown as Record<string, { deleteMany?: (args: unknown) => Promise<unknown> }>)[
        model.name.charAt(0).toLowerCase() + model.name.slice(1)
      ];
      await delegate?.deleteMany?.({ where: { companyId } }).catch(() => undefined);
    }
  }
}

async function seedHolidayYears(companyId: string, years: number[]): Promise<void> {
  for (const year of years) {
    for (const holiday of colombianHolidays(year)) {
      const date = fromDateKey(holiday.date);
      const exists = await prisma.holiday.findFirst({ where: { companyId, date, locationId: null } });
      if (!exists) {
        await prisma.holiday.create({ data: { companyId, date, name: holiday.name, country: 'CO' } });
      }
    }
  }
}

async function createLocations(companyId: string) {
  const data = [
    { name: 'Sede Principal Barranquilla', code: 'BAQ', city: 'Barranquilla', address: 'Carrera 53 No. 82-165', latitude: 11.0041, longitude: -74.8071 },
    { name: 'Sede Bogota', code: 'BOG', city: 'Bogota', address: 'Calle 100 No. 19-54', latitude: 4.6845, longitude: -74.0466 },
    { name: 'Centro de Distribucion Cartagena', code: 'CTG', city: 'Cartagena', address: 'Zona Industrial Mamonal Km 5', latitude: 10.3234, longitude: -75.4884 },
  ];
  const locations = [];
  for (const row of data) {
    const location = await prisma.location.create({
      data: {
        companyId,
        name: row.name,
        code: row.code,
        city: row.city,
        address: row.address,
        state: 'Atlantico',
        country: 'CO',
        timezone: 'America/Bogota',
        latitude: new Prisma.Decimal(row.latitude),
        longitude: new Prisma.Decimal(row.longitude),
      },
    });
    await prisma.geofence.create({
      data: {
        companyId,
        locationId: location.id,
        name: `Geocerca ${row.code}`,
        latitude: new Prisma.Decimal(row.latitude),
        longitude: new Prisma.Decimal(row.longitude),
        radiusMeters: 200,
      },
    });
    locations.push(location);
  }
  return locations;
}

async function createDepartments(companyId: string) {
  const general = await prisma.department.create({
    data: { companyId, name: 'Direccion General', code: 'DG', path: 'Direccion General' },
  });
  const children = [
    'Talento Humano',
    'Tecnologia',
    'Comercial',
    'Operaciones',
    'Financiera',
    'Servicio al Cliente',
    'Mercadeo',
  ];
  const departments = [general];
  for (const name of children) {
    departments.push(
      await prisma.department.create({
        data: {
          companyId,
          name,
          code: name.slice(0, 3).toUpperCase(),
          parentId: general.id,
          path: `Direccion General / ${name}`,
        },
      }),
    );
  }
  return departments;
}

async function createCostCenters(companyId: string) {
  const data = [
    { code: 'CC-ADM', name: 'Administracion' },
    { code: 'CC-COM', name: 'Comercial' },
    { code: 'CC-OPE', name: 'Operaciones' },
    { code: 'CC-TEC', name: 'Tecnologia' },
  ];
  const out = [];
  for (const row of data) {
    out.push(await prisma.costCenter.create({ data: { companyId, ...row } }));
  }
  return out;
}

const POSITION_CATALOG: Array<{ name: string; department: string; level: string; family: string; min: number; max: number }> = [
  { name: 'Gerente General', department: 'Direccion General', level: 'Directivo', family: 'Direccion', min: 18000000, max: 25000000 },
  { name: 'Director de Talento Humano', department: 'Talento Humano', level: 'Directivo', family: 'Talento Humano', min: 11000000, max: 15000000 },
  { name: 'Analista de Talento Humano', department: 'Talento Humano', level: 'Profesional', family: 'Talento Humano', min: 3500000, max: 4800000 },
  { name: 'Especialista de Seleccion', department: 'Talento Humano', level: 'Profesional', family: 'Talento Humano', min: 4000000, max: 5500000 },
  { name: 'Coordinador de Bienestar', department: 'Talento Humano', level: 'Coordinacion', family: 'Talento Humano', min: 5000000, max: 6500000 },
  { name: 'Director de Tecnologia', department: 'Tecnologia', level: 'Directivo', family: 'Tecnologia', min: 12000000, max: 16000000 },
  { name: 'Lider Tecnico', department: 'Tecnologia', level: 'Liderazgo', family: 'Tecnologia', min: 8000000, max: 11000000 },
  { name: 'Desarrollador Senior', department: 'Tecnologia', level: 'Senior', family: 'Tecnologia', min: 7000000, max: 9500000 },
  { name: 'Desarrollador Junior', department: 'Tecnologia', level: 'Junior', family: 'Tecnologia', min: 3200000, max: 4500000 },
  { name: 'Analista de Datos', department: 'Tecnologia', level: 'Profesional', family: 'Tecnologia', min: 5000000, max: 7000000 },
  { name: 'Especialista de Soporte TI', department: 'Tecnologia', level: 'Profesional', family: 'Tecnologia', min: 3500000, max: 5000000 },
  { name: 'Director Comercial', department: 'Comercial', level: 'Directivo', family: 'Comercial', min: 11000000, max: 15000000 },
  { name: 'Ejecutivo de Cuenta', department: 'Comercial', level: 'Profesional', family: 'Comercial', min: 3800000, max: 5500000 },
  { name: 'Asesor Comercial', department: 'Comercial', level: 'Auxiliar', family: 'Comercial', min: 2200000, max: 3200000 },
  { name: 'Coordinador de Ventas', department: 'Comercial', level: 'Coordinacion', family: 'Comercial', min: 5500000, max: 7500000 },
  { name: 'Director de Operaciones', department: 'Operaciones', level: 'Directivo', family: 'Operaciones', min: 11000000, max: 15000000 },
  { name: 'Coordinador Logistico', department: 'Operaciones', level: 'Coordinacion', family: 'Operaciones', min: 4800000, max: 6500000 },
  { name: 'Auxiliar de Bodega', department: 'Operaciones', level: 'Auxiliar', family: 'Operaciones', min: 1500000, max: 2000000 },
  { name: 'Operario de Planta', department: 'Operaciones', level: 'Operativo', family: 'Operaciones', min: 1400000, max: 1900000 },
  { name: 'Director Financiero', department: 'Financiera', level: 'Directivo', family: 'Financiera', min: 12000000, max: 16000000 },
  { name: 'Analista Contable', department: 'Financiera', level: 'Profesional', family: 'Financiera', min: 3500000, max: 4800000 },
  { name: 'Tesorero', department: 'Financiera', level: 'Profesional', family: 'Financiera', min: 5000000, max: 6800000 },
  { name: 'Coordinador de Servicio al Cliente', department: 'Servicio al Cliente', level: 'Coordinacion', family: 'Servicio', min: 4500000, max: 6000000 },
  { name: 'Agente de Servicio al Cliente', department: 'Servicio al Cliente', level: 'Auxiliar', family: 'Servicio', min: 1800000, max: 2600000 },
  { name: 'Especialista de Mercadeo Digital', department: 'Mercadeo', level: 'Profesional', family: 'Mercadeo', min: 4200000, max: 6000000 },
];

async function createPositions(companyId: string, departments: Array<{ id: string; name: string }>) {
  const byName = new Map(departments.map((d) => [d.name, d.id]));
  const positions = [];
  for (const row of POSITION_CATALOG) {
    positions.push(
      await prisma.position.create({
        data: {
          companyId,
          name: row.name,
          code: slugify(row.name).slice(0, 20).toUpperCase(),
          level: row.level,
          family: row.family,
          departmentId: byName.get(row.department) ?? null,
          description: `Responsable de las funciones propias del cargo ${row.name} en el area de ${row.department}.`,
          salaryRangeMin: encrypt(row.min),
          salaryRangeMax: encrypt(row.max),
        },
      }),
    );
  }
  return positions;
}

async function createCompetencies(companyId: string, positions: Array<{ id: string; level: string | null }>) {
  const catalog = [
    { name: 'Orientacion al resultado', category: 'Organizacional', isCore: true },
    { name: 'Trabajo en equipo', category: 'Organizacional', isCore: true },
    { name: 'Comunicacion efectiva', category: 'Organizacional', isCore: true },
    { name: 'Orientacion al cliente', category: 'Organizacional', isCore: true },
    { name: 'Adaptabilidad al cambio', category: 'Organizacional', isCore: true },
    { name: 'Liderazgo de equipos', category: 'Liderazgo' },
    { name: 'Pensamiento estrategico', category: 'Liderazgo' },
    { name: 'Toma de decisiones', category: 'Liderazgo' },
    { name: 'Resolucion de problemas', category: 'Tecnica' },
    { name: 'Calidad y detalle', category: 'Tecnica' },
    { name: 'Conocimiento tecnico del cargo', category: 'Tecnica' },
    { name: 'Innovacion', category: 'Tecnica' },
  ];

  const competencies = [];
  for (const row of catalog) {
    const competency = await prisma.competency.create({
      data: {
        companyId,
        name: row.name,
        category: row.category,
        isCore: row.isCore ?? false,
        description: `Capacidad demostrada de ${row.name.toLowerCase()} en el desempeno diario del cargo.`,
      },
    });
    const levelNames = ['En desarrollo', 'Basico', 'Competente', 'Avanzado', 'Referente'];
    for (const [index, name] of levelNames.entries()) {
      await prisma.competencyLevel.create({
        data: {
          companyId,
          competencyId: competency.id,
          level: index + 1,
          name,
          behaviors: `Nivel ${index + 1}: comportamientos observables de ${row.name.toLowerCase()}.`,
        },
      });
    }
    competencies.push(competency);
  }

  // Core competencies apply to every position; leadership only to leaders.
  const core = competencies.filter((c) => c.isCore);
  const leadership = competencies.filter((c) => c.category === 'Liderazgo');
  const technical = competencies.filter((c) => c.category === 'Tecnica');

  for (const position of positions) {
    const isLeader = ['Directivo', 'Liderazgo', 'Coordinacion'].includes(position.level ?? '');
    const selected = [...core, ...(isLeader ? leadership : []), ...pickMany(technical, 2)];
    for (const competency of selected) {
      await prisma.positionCompetency.create({
        data: {
          companyId,
          positionId: position.id,
          competencyId: competency.id,
          requiredLevel: isLeader ? 4 : 3,
          weight: competency.isCore ? 2 : 1,
        },
      });
    }
  }

  return competencies;
}

async function createCompanyValues(companyId: string) {
  const values = [
    { name: 'Integridad', icon: 'ShieldCheck', color: '#1d4ed8' },
    { name: 'Colaboracion', icon: 'Users', color: '#0ea5e9' },
    { name: 'Excelencia', icon: 'Award', color: '#f59e0b' },
    { name: 'Innovacion', icon: 'Lightbulb', color: '#8b5cf6' },
    { name: 'Respeto', icon: 'Heart', color: '#ec4899' },
  ];
  const out = [];
  for (const [index, value] of values.entries()) {
    out.push(
      await prisma.companyValue.create({
        data: {
          companyId,
          name: value.name,
          icon: value.icon,
          color: value.color,
          position: index,
          description: `Vivimos la ${value.name.toLowerCase()} en cada decision y en cada interaccion.`,
        },
      }),
    );
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  People                                                                     */
/* -------------------------------------------------------------------------- */

interface OrgRefs {
  locations: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; name: string; level: string | null; departmentId: string | null }>;
  costCenters: Array<{ id: string }>;
}

async function createEmployees(companyId: string, refs: OrgRefs) {
  const employees: Array<{
    id: string;
    fullName: string;
    email: string;
    positionId: string | null;
    departmentId: string | null;
    locationId: string | null;
    level: string | null;
    hiredAt: Date;
    status: string;
    managerId: string | null;
  }> = [];

  const positionByName = new Map(refs.positions.map((p) => [p.name, p]));
  const usedEmails = new Set<string>();
  let sequence = 0;

  const createOne = async (params: {
    positionName: string;
    managerId: string | null;
    hiredAt: Date;
    status?: 'active' | 'inactive';
    terminatedAt?: Date | null;
    exitReason?: string | null;
    locationId?: string;
  }) => {
    sequence += 1;
    const position = positionByName.get(params.positionName)!;
    const isFemale = chance(0.48);
    const firstName = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
    const lastName = pick(LAST_NAMES);
    const secondLastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName} ${secondLastName}`;

    let emailBase = `${slugify(firstName)}.${slugify(lastName)}`;
    let email = `${emailBase}@demo.com`;
    let suffix = 1;
    while (usedEmails.has(email)) {
      suffix += 1;
      email = `${emailBase}${suffix}@demo.com`;
    }
    usedEmails.add(email);

    const locationId = params.locationId ?? pick(refs.locations).id;
    const employee = await prisma.employee.create({
      data: {
        companyId,
        employeeCode: `EMP-${String(sequence).padStart(5, '0')}`,
        firstName,
        lastName,
        secondLastName,
        fullName,
        email,
        personalEmail: `${emailBase}${suffix > 1 ? suffix : ''}@correo.com`,
        phone: `605${int(3000000, 3999999)}`,
        mobile: `3${int(10, 25)}${int(1000000, 9999999)}`,
        extension: String(int(100, 899)),
        documentType: 'CC',
        documentNumber: String(int(8000000, 1299999999)),
        birthDate: addDays(new Date(Date.UTC(int(1970, 2002), int(0, 11), int(1, 28))), 0),
        gender: isFemale ? 'female' : 'male',
        nationality: 'Colombiana',
        address: `Calle ${int(1, 120)} No. ${int(1, 99)}-${int(1, 99)}`,
        city: pick(['Barranquilla', 'Bogota', 'Cartagena', 'Soledad', 'Puerto Colombia']),
        status: params.status ?? 'active',
        hiredAt: params.hiredAt,
        terminatedAt: params.terminatedAt ?? null,
        exitReason: params.exitReason ?? null,
        positionId: position.id,
        departmentId: position.departmentId,
        locationId,
        costCenterId: pick(refs.costCenters).id,
        managerId: params.managerId,
        workModality: pick(['onsite', 'onsite', 'hybrid', 'remote'] as const),
        dataConsentAt: params.hiredAt,
      },
    });

    await prisma.employeePersonalData.create({
      data: {
        companyId,
        employeeId: employee.id,
        maritalStatus: pick(['soltero', 'casado', 'union_libre', 'divorciado']),
        bloodType: pick(['O+', 'A+', 'B+', 'O-', 'AB+']),
        eps: pick(['EPS SURA', 'EPS Sanitas', 'Nueva EPS', 'Salud Total', 'Coosalud']),
        arl: 'ARL SURA',
        pensionFund: pick(['Porvenir', 'Proteccion', 'Colfondos', 'Colpensiones']),
        severanceFund: pick(['Porvenir', 'Proteccion']),
        bankName: encrypt(pick(['Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogota'])),
        bankAccountType: encrypt(pick(['Ahorros', 'Corriente'])),
        bankAccountNumber: encrypt(String(int(10000000000, 99999999999))),
        baseSalary: encrypt(int(1400000, 20000000)),
        shirtSize: pick(['S', 'M', 'L', 'XL']),
        pantsSize: String(int(28, 40)),
        shoeSize: String(int(35, 44)),
      },
    });

    await prisma.emergencyContact.create({
      data: {
        companyId,
        employeeId: employee.id,
        name: `${pick(FIRST_NAMES_F)} ${lastName}`,
        relationship: pick(['conyuge', 'madre', 'padre', 'hermano']),
        phone: `3${int(10, 25)}${int(1000000, 9999999)}`,
        isPrimary: true,
      },
    });

    await prisma.education.create({
      data: {
        companyId,
        employeeId: employee.id,
        level: pick(['profesional', 'tecnologo', 'especializacion', 'tecnico']),
        institution: pick([
          'Universidad del Norte',
          'Universidad del Atlantico',
          'Universidad Javeriana',
          'SENA',
          'Universidad Autonoma del Caribe',
        ]),
        degree: pick([
          'Administracion de Empresas',
          'Ingenieria Industrial',
          'Ingenieria de Sistemas',
          'Psicologia',
          'Contaduria Publica',
          'Mercadeo',
        ]),
        endDate: new Date(Date.UTC(int(2005, 2022), int(0, 11), 15)),
        isCompleted: true,
      },
    });

    const contractType = pick(['indefinido', 'indefinido', 'indefinido', 'fijo', 'obra_labor']);
    await prisma.employmentContract.create({
      data: {
        companyId,
        employeeId: employee.id,
        contractType,
        startDate: params.hiredAt,
        endDate:
          contractType === 'fijo'
            ? addMonths(params.hiredAt, 12)
            : params.terminatedAt ?? null,
        probationEndsAt: addMonths(params.hiredAt, 2),
        positionId: position.id,
        departmentId: position.departmentId,
        locationId,
        workModality: 'onsite',
        weeklyHours: 46,
        baseSalary: encrypt(int(1400000, 20000000)),
        isCurrent: !params.terminatedAt,
      },
    });

    employees.push({
      id: employee.id,
      fullName,
      email,
      positionId: employee.positionId,
      departmentId: employee.departmentId,
      locationId: employee.locationId,
      level: position.level,
      hiredAt: params.hiredAt,
      status: employee.status,
      managerId: employee.managerId,
    });

    return employee.id;
  };

  const today = new Date();
  const yearsAgo = (years: number) => addDays(today, -Math.round(years * 365));

  // Leadership first, so the hierarchy is consistent.
  const ceo = await createOne({ positionName: 'Gerente General', managerId: null, hiredAt: yearsAgo(9) });

  const directors: Record<string, string> = {};
  for (const positionName of [
    'Director de Talento Humano',
    'Director de Tecnologia',
    'Director Comercial',
    'Director de Operaciones',
    'Director Financiero',
  ]) {
    directors[positionName] = await createOne({
      positionName,
      managerId: ceo,
      hiredAt: yearsAgo(int(4, 8)),
    });
  }

  const coordinators: Record<string, string> = {};
  const coordinatorMap: Array<[string, string]> = [
    ['Coordinador de Bienestar', 'Director de Talento Humano'],
    ['Lider Tecnico', 'Director de Tecnologia'],
    ['Coordinador de Ventas', 'Director Comercial'],
    ['Coordinador Logistico', 'Director de Operaciones'],
    ['Coordinador de Servicio al Cliente', 'Director Comercial'],
  ];
  for (const [positionName, managerPosition] of coordinatorMap) {
    coordinators[positionName] = await createOne({
      positionName,
      managerId: directors[managerPosition],
      hiredAt: yearsAgo(int(2, 6)),
    });
  }

  const contributors: Array<[string, string, number]> = [
    ['Analista de Talento Humano', directors['Director de Talento Humano'], 3],
    ['Especialista de Seleccion', directors['Director de Talento Humano'], 2],
    ['Desarrollador Senior', coordinators['Lider Tecnico'], 8],
    ['Desarrollador Junior', coordinators['Lider Tecnico'], 9],
    ['Analista de Datos', directors['Director de Tecnologia'], 3],
    ['Especialista de Soporte TI', directors['Director de Tecnologia'], 4],
    ['Ejecutivo de Cuenta', coordinators['Coordinador de Ventas'], 8],
    ['Asesor Comercial', coordinators['Coordinador de Ventas'], 12],
    ['Auxiliar de Bodega', coordinators['Coordinador Logistico'], 14],
    ['Operario de Planta', coordinators['Coordinador Logistico'], 16],
    ['Analista Contable', directors['Director Financiero'], 5],
    ['Tesorero', directors['Director Financiero'], 2],
    ['Agente de Servicio al Cliente', coordinators['Coordinador de Servicio al Cliente'], 16],
    ['Especialista de Mercadeo Digital', directors['Director Comercial'], 3],
  ];

  for (const [positionName, managerId, quantity] of contributors) {
    for (let i = 0; i < quantity; i += 1) {
      await createOne({
        positionName,
        managerId,
        hiredAt: addDays(today, -int(20, 2200)),
      });
    }
  }

  // A few former employees so turnover and exit reasons have data.
  for (let i = 0; i < 9; i += 1) {
    const hiredAt = addDays(today, -int(400, 1800));
    await createOne({
      positionName: pick(['Asesor Comercial', 'Auxiliar de Bodega', 'Desarrollador Junior', 'Agente de Servicio al Cliente']),
      managerId: pick(Object.values(coordinators)),
      hiredAt,
      status: 'inactive',
      terminatedAt: addDays(hiredAt, int(120, 700)),
      exitReason: pick(['renuncia', 'renuncia', 'fin_contrato', 'terminacion', 'mutuo_acuerdo']),
    });
  }

  return employees;
}

/**
 * Flujos de aprobacion de la empresa de demostracion.
 *
 * Sin una definicion configurada el motor aprueba las solicitudes de inmediato,
 * que es lo correcto para una instalacion nueva pero deja la bandeja del jefe
 * siempre vacia. La demo si los configura, para que se pueda recorrer el
 * circuito completo: solicitar, aprobar y ver el efecto.
 */
async function createApprovalFlows(companyId: string) {
  const flows = [
    {
      key: 'ausencias',
      name: 'Aprobacion de ausencias',
      entityType: 'leave_request',
      description: 'El jefe directo aprueba; talento humano entra cuando supera diez dias.',
      steps: [
        { name: 'Jefe directo', approverType: 'direct_manager' as const, condition: {}, slaHours: 48 },
        {
          name: 'Talento humano',
          approverType: 'hr' as const,
          // Solo escala en ausencias largas.
          condition: { field: 'days', op: 'gt', value: 10 },
          slaHours: 72,
        },
      ],
    },
    {
      key: 'requisiciones',
      name: 'Aprobacion de requisiciones de personal',
      entityType: 'job_requisition',
      description: 'Jefe del area y luego talento humano.',
      steps: [
        { name: 'Jefe del area', approverType: 'department_manager' as const, condition: {}, slaHours: 72 },
        { name: 'Talento humano', approverType: 'hr' as const, condition: {}, slaHours: 72 },
      ],
    },
  ];

  for (const flow of flows) {
    const definition = await prisma.workflowDefinition.create({
      data: {
        companyId,
        key: flow.key,
        name: flow.name,
        entityType: flow.entityType,
        description: flow.description,
        mode: 'sequential',
        isActive: true,
      },
    });

    for (const [index, step] of flow.steps.entries()) {
      await prisma.workflowStep.create({
        data: {
          companyId,
          definitionId: definition.id,
          position: index,
          name: step.name,
          approverType: step.approverType,
          condition: step.condition as Prisma.InputJsonValue,
          slaHours: step.slaHours,
        },
      });
    }
  }

  console.log(`  ${flows.length} flujos de aprobacion configurados`);
}

async function createDemoUsers(
  companyId: string,
  employees: Array<{
    id: string;
    fullName: string;
    email: string;
    level: string | null;
    departmentId: string | null;
    managerId: string | null;
    status: string;
  }>,
): Promise<{ demoEmployeeId: string | null }> {
  // Las cuentas de demostracion tienen que apuntar a gente activa: un
  // colaborador retirado no recibe encuestas, no acumula vacaciones y deja la
  // demo con pantallas vacias.
  const isActive = (e: { status?: string }) => e.status === undefined || e.status === 'active';

  const hrDirector = employees.find((e) => e.level === 'Directivo' && isActive(e));
  const manager = employees.find((e) => e.level === 'Coordinacion' && isActive(e));

  // Quien explora la demo espera que `manager@demo.com` sea el jefe de
  // `empleado@demo.com`: asi la bandeja de aprobaciones de la cuenta de jefe
  // muestra las solicitudes de la cuenta de colaborador. Se prefiere alguien
  // que ya reporte a ese jefe; si no hay, se reasigna.
  const isJunior = (e: { level: string | null }) => e.level === 'Junior' || e.level === 'Auxiliar';
  const employee =
    employees.find((e) => isJunior(e) && isActive(e) && e.managerId === manager?.id) ??
    employees.find((e) => isJunior(e) && isActive(e));

  if (employee && manager && employee.managerId !== manager.id) {
    await prisma.employee.update({ where: { id: employee.id }, data: { managerId: manager.id } });
    employee.managerId = manager.id;
  }

  const accounts: Array<{
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    employeeId?: string;
  }> = [
    { email: 'admin@demo.com', firstName: 'Admin', lastName: 'Demo', roles: ['company_admin'] },
    {
      email: 'hr@demo.com',
      firstName: 'Talento',
      lastName: 'Humano',
      roles: ['hr_admin'],
      employeeId: hrDirector?.id,
    },
    {
      email: 'manager@demo.com',
      firstName: 'Jefe',
      lastName: 'Demo',
      roles: ['manager'],
      employeeId: manager?.id,
    },
    {
      email: 'empleado@demo.com',
      firstName: 'Colaborador',
      lastName: 'Demo',
      roles: ['employee'],
      employeeId: employee?.id,
    },
    { email: 'etica@demo.com', firstName: 'Oficial', lastName: 'Etica', roles: ['ethics_officer'] },
  ];

  for (const account of accounts) {
    await upsertUser(prisma, {
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      password: DEMO_PASSWORD,
      companyId,
      roleKeys: account.roles,
      employeeId: account.employeeId,
    });
  }

  const demoEmployeeId = employee?.id ?? null;

  // Every remaining collaborator gets a portal account too.
  const employeeRole = await prisma.role.findFirst({ where: { companyId, key: 'employee' } });
  const managerRole = await prisma.role.findFirst({ where: { companyId, key: 'manager' } });
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const row of employees) {
    const current = await prisma.employee.findFirst({
      where: { id: row.id },
      select: { userId: true, firstName: true, lastName: true, email: true, managerId: true },
    });
    if (current?.userId) continue;

    const hasReports = await prisma.employee.count({ where: { managerId: row.id, deletedAt: null } });
    const user = await prisma.user.create({
      data: {
        email: row.email,
        firstName: current?.firstName ?? row.fullName.split(' ')[0],
        lastName: current?.lastName ?? row.fullName.split(' ')[1] ?? '',
        passwordHash,
        status: 'active',
        lastCompanyId: companyId,
      },
    });
    const membership = await prisma.companyUser.create({
      data: { companyId, userId: user.id, isActive: true, isDefault: true },
    });
    const roleId = hasReports > 0 ? managerRole?.id : employeeRole?.id;
    if (roleId) {
      await prisma.userRole.create({ data: { companyUserId: membership.id, roleId } });
    }
    await prisma.employee.update({ where: { id: row.id }, data: { userId: user.id } });
  }

  return { demoEmployeeId };
}

async function createDocuments(companyId: string, employees: Array<{ id: string; hiredAt: Date }>) {
  const types = await prisma.documentType.findMany({ where: { companyId } });
  const required = types.filter((type) => type.isRequired);
  const expiring = types.filter((type) => type.hasExpiration);

  for (const employee of employees) {
    for (const type of required) {
      if (chance(0.12)) continue; // some documents are still missing on purpose
      await prisma.employeeDocument.create({
        data: {
          companyId,
          employeeId: employee.id,
          documentTypeId: type.id,
          name: `${type.name} - ${toDateKey(employee.hiredAt)}`,
          issuedAt: employee.hiredAt,
          status: 'valid',
        },
      });
    }
    if (chance(0.25)) {
      const type = pick(expiring);
      const expiresAt = addDays(new Date(), int(-60, 120));
      await prisma.employeeDocument.create({
        data: {
          companyId,
          employeeId: employee.id,
          documentTypeId: type.id,
          name: type.name,
          issuedAt: addDays(expiresAt, -365),
          expiresAt,
          status: expiresAt < new Date() ? 'expired' : 'expiring',
        },
      });
    }
  }

  // A few pending document requests for the HR dashboard.
  const missingType = types.find((type) => type.code === 'certificado_estudios');
  if (missingType) {
    for (const employee of pickMany(employees, 12)) {
      await prisma.documentRequest.create({
        data: {
          companyId,
          employeeId: employee.id,
          documentTypeId: missingType.id,
          dueDate: addDays(new Date(), 15),
          note: 'Por favor cargue el certificado de estudios para completar su legajo.',
        },
      });
    }
  }
}

async function createAssets(
  companyId: string,
  employees: Array<{ id: string }>,
  locations: Array<{ id: string }>,
) {
  const catalog = [
    { type: 'laptop', names: ['Portatil Dell Latitude 5440', 'Portatil Lenovo ThinkPad T14', 'MacBook Air M2'] },
    { type: 'celular', names: ['Celular Samsung A54', 'iPhone 13'] },
    { type: 'monitor', names: ['Monitor LG 24"', 'Monitor Samsung 27"'] },
    { type: 'dotacion', names: ['Dotacion operativa', 'Uniforme corporativo'] },
  ];

  let sequence = 0;
  for (const employee of employees) {
    const count = chance(0.65) ? int(1, 3) : 0;
    for (let i = 0; i < count; i += 1) {
      sequence += 1;
      const group = pick(catalog);
      const asset = await prisma.asset.create({
        data: {
          companyId,
          assetType: group.type,
          name: pick(group.names),
          code: `ACT-${String(sequence).padStart(5, '0')}`,
          serialNumber: `SN${int(100000, 999999)}`,
          brand: pick(['Dell', 'Lenovo', 'Apple', 'Samsung', 'LG']),
          locationId: pick(locations).id,
          status: 'assigned',
          purchaseDate: addDays(new Date(), -int(100, 1400)),
        },
      });
      await prisma.assetAssignment.create({
        data: {
          companyId,
          assetId: asset.id,
          employeeId: employee.id,
          assignedAt: addDays(new Date(), -int(30, 900)),
          conditionOut: 'Bueno',
        },
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Time and leaves                                                            */
/* -------------------------------------------------------------------------- */

async function createSchedulesAndAttendance(
  companyId: string,
  employees: Array<{ id: string; status: string }>,
) {
  const schedule = await prisma.workSchedule.create({
    data: {
      companyId,
      name: 'Jornada administrativa (L-V 8:00 a 17:30)',
      description: 'Horario estandar con una hora de almuerzo.',
      toleranceMinutes: 10,
      isDefault: true,
    },
  });
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const isWorkingDay = weekday >= 1 && weekday <= 5;
    await prisma.scheduleRule.create({
      data: {
        companyId,
        scheduleId: schedule.id,
        weekday,
        startTime: isWorkingDay ? '08:00' : '00:00',
        endTime: isWorkingDay ? '17:30' : '00:00',
        breakMinutes: isWorkingDay ? 60 : 0,
        isWorkingDay,
      },
    });
  }

  const shiftSchedule = await prisma.workSchedule.create({
    data: {
      companyId,
      name: 'Turnos de operacion',
      toleranceMinutes: 5,
    },
  });
  const shifts = [
    { name: 'Turno manana', code: 'T1', startTime: '06:00', endTime: '14:00', color: '#0ea5e9' },
    { name: 'Turno tarde', code: 'T2', startTime: '14:00', endTime: '22:00', color: '#f59e0b' },
    { name: 'Turno noche', code: 'T3', startTime: '22:00', endTime: '06:00', color: '#6366f1' },
  ];
  const createdShifts = [];
  for (const shift of shifts) {
    createdShifts.push(
      await prisma.shift.create({
        data: {
          companyId,
          ...shift,
          breakMinutes: 60,
          crossesMidnight: shift.code === 'T3',
          scheduleId: shiftSchedule.id,
        },
      }),
    );
  }

  const active = employees.filter((employee) => employee.status === 'active');
  await prisma.employeeSchedule.createMany({
    data: active.map((employee) => ({
      companyId,
      employeeId: employee.id,
      scheduleId: schedule.id,
      startDate: addDays(new Date(), -400),
    })),
  });

  // Three months of attendance for a representative sample.
  const holidays = new Set(
    (
      await prisma.holiday.findMany({
        where: { companyId, date: { gte: addDays(new Date(), -95) } },
        select: { date: true },
      })
    ).map((holiday) => toDateKey(holiday.date)),
  );

  const sample = pickMany(active, Math.min(45, active.length));
  const attendanceRows: Prisma.AttendanceDayCreateManyInput[] = [];
  const clockRows: Prisma.TimeClockEntryCreateManyInput[] = [];

  for (let offset = 90; offset >= 1; offset -= 1) {
    const date = fromDateKey(toDateKey(addDays(new Date(), -offset)));
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = holidays.has(toDateKey(date));

    for (const employee of sample) {
      if (isWeekend) {
        attendanceRows.push({
          companyId,
          employeeId: employee.id,
          date,
          status: 'rest',
          computedAt: new Date(),
        });
        continue;
      }
      if (isHoliday) {
        attendanceRows.push({
          companyId,
          employeeId: employee.id,
          date,
          status: 'holiday',
          computedAt: new Date(),
        });
        continue;
      }

      const roll = random();
      if (roll < 0.03) {
        attendanceRows.push({
          companyId,
          employeeId: employee.id,
          date,
          status: 'absent',
          scheduledStart: '08:00',
          scheduledEnd: '17:30',
          computedAt: new Date(),
        });
        continue;
      }

      const lateMinutes = roll < 0.15 ? int(11, 45) : 0;
      const overtimeMinutes = roll > 0.9 ? int(30, 120) : 0;
      const firstIn = new Date(date.getTime() + (8 * 60 + lateMinutes) * 60_000);
      const lastOut = new Date(date.getTime() + (17 * 60 + 30 + overtimeMinutes) * 60_000);

      attendanceRows.push({
        companyId,
        employeeId: employee.id,
        date,
        status: lateMinutes > 0 ? 'late' : 'present',
        scheduledStart: '08:00',
        scheduledEnd: '17:30',
        firstIn,
        lastOut,
        workedMinutes: Math.round((lastOut.getTime() - firstIn.getTime()) / 60_000) - 60,
        breakMinutes: 60,
        lateMinutes,
        overtimeMinutes,
        computedAt: new Date(),
      });

      if (offset <= 14) {
        clockRows.push(
          { companyId, employeeId: employee.id, type: 'in', source: 'web', occurredAt: firstIn, localDate: date },
          { companyId, employeeId: employee.id, type: 'out', source: 'web', occurredAt: lastOut, localDate: date },
        );
      }
    }
  }

  for (let i = 0; i < attendanceRows.length; i += 2000) {
    await prisma.attendanceDay.createMany({
      data: attendanceRows.slice(i, i + 2000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < clockRows.length; i += 2000) {
    await prisma.timeClockEntry.createMany({ data: clockRows.slice(i, i + 2000) });
  }

  // Published shift plan for the next two weeks in the operations area.
  const operations = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, department: { name: 'Operaciones' }, status: 'active' },
    select: { id: true },
    take: 20,
  });
  const assignments: Prisma.ShiftAssignmentCreateManyInput[] = [];
  for (let day = 0; day < 14; day += 1) {
    const date = fromDateKey(toDateKey(addDays(new Date(), day)));
    for (const [index, employee] of operations.entries()) {
      assignments.push({
        companyId,
        employeeId: employee.id,
        shiftId: createdShifts[(index + day) % createdShifts.length].id,
        date,
        isPublished: true,
      });
    }
  }
  if (assignments.length) {
    await prisma.shiftAssignment.createMany({ data: assignments, skipDuplicates: true });
  }
}

async function createLeaves(
  companyId: string,
  employees: Array<{ id: string; hiredAt: Date; status: string }>,
  /**
   * La cuenta `empleado@demo.com` recibe menos ausencias pasadas, para que le
   * quede saldo suficiente y quien explora la demo pueda solicitar vacaciones
   * y recorrer el circuito de aprobacion sin quedarse sin dias.
   */
  demoEmployeeId: string | null = null,
) {
  const types = await prisma.leaveType.findMany({ where: { companyId } });
  const vacation = types.find((type) => type.code === 'vacaciones')!;
  const policy = await prisma.leavePolicy.findFirst({ where: { companyId, isDefault: true } });
  const holidays = new Set(
    (await prisma.holiday.findMany({ where: { companyId }, select: { date: true } })).map((h) =>
      toDateKey(h.date),
    ),
  );

  const active = employees.filter((employee) => employee.status === 'active');
  const year = new Date().getUTCFullYear();

  for (const employee of active) {
    // Past and upcoming absences.
    const total = employee.id === demoEmployeeId ? 1 : int(1, 4);
    for (let i = 0; i < total; i += 1) {
      // Al colaborador de demostracion no se le consumen vacaciones.
      const type =
        employee.id === demoEmployeeId
          ? (types.find((t) => t.code !== 'vacaciones') ?? vacation)
          : chance(0.55)
            ? vacation
            : pick(types);
      const start = fromDateKey(toDateKey(addDays(new Date(), int(-240, 60))));
      const length = type.code === 'vacaciones' ? int(3, 10) : int(1, 4);
      const end = addDays(start, length - 1);

      const overlapping = await prisma.leaveRequest.findFirst({
        where: {
          companyId,
          employeeId: employee.id,
          deletedAt: null,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { id: true },
      });
      if (overlapping) continue;

      const days = countDays(start, end, {
        businessDays: type.countsBusinessDays,
        holidays,
      });
      if (days <= 0) continue;

      const isPast = end < new Date();
      const status = isPast ? 'taken' : chance(0.75) ? 'approved' : 'pending';

      await prisma.leaveRequest.create({
        data: {
          companyId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          startDate: start,
          endDate: end,
          requestedDays: new Prisma.Decimal(days),
          status,
          reason: pick([
            'Descanso programado',
            'Asuntos personales',
            'Viaje familiar',
            'Cita medica',
            'Tramite personal',
          ]),
          decidedAt: status === 'pending' ? null : addDays(start, -2),
        },
      });
    }

    // Vacation balance for the current year.
    const taken = await prisma.leaveRequest.aggregate({
      where: {
        companyId,
        employeeId: employee.id,
        leaveTypeId: vacation.id,
        status: { in: ['approved', 'taken'] },
      },
      _sum: { requestedDays: true },
    });
    const pending = await prisma.leaveRequest.aggregate({
      where: { companyId, employeeId: employee.id, leaveTypeId: vacation.id, status: 'pending' },
      _sum: { requestedDays: true },
    });

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const from = employee.hiredAt > startOfYear ? employee.hiredAt : startOfYear;
    const daysWorked = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86_400_000));
    const accrued = Number(((daysWorked / 365) * Number(policy?.daysPerYear ?? 15)).toFixed(2));

    await prisma.leaveBalance.create({
      data: {
        companyId,
        employeeId: employee.id,
        leaveTypeId: vacation.id,
        policyId: policy?.id ?? null,
        year,
        accruedDays: new Prisma.Decimal(accrued),
        takenDays: new Prisma.Decimal(Number(taken._sum.requestedDays ?? 0)),
        pendingDays: new Prisma.Decimal(Number(pending._sum.requestedDays ?? 0)),
        carryOverDays: new Prisma.Decimal(chance(0.3) ? int(1, 12) : 0),
        lastAccrualAt: new Date(),
      },
    });
  }

  // Personnel events (novedades) that HR follows up.
  for (const employee of pickMany(active, 25)) {
    await prisma.employeeEvent.create({
      data: {
        companyId,
        employeeId: employee.id,
        eventType: pick(['horas_extra', 'felicitacion', 'prestamo_equipo', 'comision', 'incapacidad_prolongada']),
        title: pick([
          'Horas extra reportadas por el jefe',
          'Felicitacion por resultados del trimestre',
          'Prestamo de equipo para trabajo en casa',
          'Comision de servicios a otra sede',
          'Seguimiento a incapacidad prolongada',
        ]),
        startDate: fromDateKey(toDateKey(addDays(new Date(), -int(1, 120)))),
        quantity: new Prisma.Decimal(int(2, 16)),
        unit: 'horas',
        status: pick(['open', 'closed']),
      },
    });
  }

  // One disciplinary case with its steps, encrypted.
  const target = pick(active);
  const disciplinary = await prisma.disciplinaryCase.create({
    data: {
      companyId,
      employeeId: target.id,
      caseNumber: 'DIS-00001',
      caseType: 'llamado_escrito',
      subject: encrypt('Incumplimiento reiterado del horario de trabajo') as string,
      description: encrypt(
        'Se registran cinco llegadas tarde en el ultimo mes sin justificacion. Se cita a descargos conforme al reglamento interno.',
      ),
      severity: 'medium',
      status: 'open',
      openedAt: addDays(new Date(), -20),
    },
  });
  await prisma.disciplinaryCaseStep.createMany({
    data: [
      {
        companyId,
        caseId: disciplinary.id,
        stepType: 'citacion',
        position: 0,
        dueDate: addDays(new Date(), -15),
        completedAt: addDays(new Date(), -16),
        content: encrypt('Citacion enviada al correo corporativo con tres dias habiles de antelacion.'),
      },
      {
        companyId,
        caseId: disciplinary.id,
        stepType: 'descargos',
        position: 1,
        dueDate: addDays(new Date(), -10),
        content: encrypt('Diligencia de descargos pendiente de realizar.'),
      },
    ],
  });
}

/* -------------------------------------------------------------------------- */
/*  Recruiting and onboarding                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_STAGES = [
  { code: 'new', name: 'Nuevo', color: '#64748b', kind: 'standard' },
  { code: 'screening', name: 'Preseleccion', color: '#0ea5e9', kind: 'standard' },
  { code: 'hr_interview', name: 'Entrevista HR', color: '#6366f1', kind: 'interview' },
  { code: 'technical_test', name: 'Prueba tecnica', color: '#8b5cf6', kind: 'assessment' },
  { code: 'manager_interview', name: 'Entrevista jefe', color: '#a855f7', kind: 'interview' },
  { code: 'references', name: 'Referencias', color: '#f59e0b', kind: 'reference' },
  { code: 'offer', name: 'Oferta', color: '#10b981', kind: 'offer' },
  { code: 'hired', name: 'Contratado', color: '#059669', kind: 'hired' },
  { code: 'rejected', name: 'Descartado', color: '#ef4444', kind: 'rejected' },
];

async function createRecruiting(
  companyId: string,
  refs: {
    departments: Array<{ id: string; name: string }>;
    positions: Array<{ id: string; name: string; departmentId: string | null }>;
    locations: Array<{ id: string }>;
    employees: Array<{ id: string; level: string | null }>;
    competencies: Array<{ id: string; isCore: boolean }>;
  },
) {
  const recruiter = refs.employees.find((e) => e.level === 'Profesional') ?? refs.employees[0];
  const vacancies = [
    'Desarrollador Senior',
    'Analista de Datos',
    'Ejecutivo de Cuenta',
    'Coordinador Logistico',
    'Agente de Servicio al Cliente',
    'Especialista de Mercadeo Digital',
  ];

  let candidateSequence = 0;

  for (const [index, positionName] of vacancies.entries()) {
    const position = refs.positions.find((p) => p.name === positionName)!;

    const requisition = await prisma.jobRequisition.create({
      data: {
        companyId,
        code: `REQ-${String(index + 1).padStart(4, '0')}`,
        title: positionName,
        positionId: position.id,
        departmentId: position.departmentId,
        locationId: pick(refs.locations).id,
        reason: pick(['nuevo_cargo', 'reemplazo', 'crecimiento']),
        openings: 1,
        neededBy: addDays(new Date(), int(20, 70)),
        justification: `Se requiere cubrir la posicion de ${positionName} para atender la demanda del area.`,
        contractType: 'indefinido',
        status: 'approved',
        approvedAt: addDays(new Date(), -int(10, 40)),
      },
    });

    const posting = await prisma.jobPosting.create({
      data: {
        companyId,
        requisitionId: requisition.id,
        code: `VAC-${String(index + 1).padStart(4, '0')}`,
        slug: `${slugify(positionName)}-${index + 1}`,
        title: positionName,
        positionId: position.id,
        departmentId: position.departmentId,
        locationId: pick(refs.locations).id,
        workModality: pick(['onsite', 'hybrid', 'remote'] as const),
        contractType: 'indefinido',
        openings: 1,
        description: `Buscamos un(a) ${positionName} para sumarse a nuestro equipo en Demo S.A.S. Seras responsable de ejecutar y mejorar los procesos del area, trabajando de la mano con equipos multidisciplinarios.`,
        requirements:
          'Formacion profesional o tecnologica afin, minimo 2 anos de experiencia en cargos similares, orientacion al resultado y trabajo en equipo.',
        benefits:
          'Contrato a termino indefinido, plan de formacion continua, dia libre de cumpleanos, modalidad flexible y plan de bienestar.',
        salaryRangeMin: encrypt(int(3000000, 5000000)),
        salaryRangeMax: encrypt(int(5500000, 9000000)),
        salaryVisible: chance(0.5),
        status: 'published',
        publishedAt: addDays(new Date(), -int(5, 45)),
        closesAt: addDays(new Date(), int(15, 60)),
        recruiterId: recruiter?.id ?? null,
        viewCount: int(40, 400),
      },
    });

    const stages = [];
    for (const [order, stage] of DEFAULT_STAGES.entries()) {
      stages.push(
        await prisma.pipelineStage.create({
          data: { companyId, jobPostingId: posting.id, position: order, ...stage },
        }),
      );
    }

    for (const competency of pickMany(refs.competencies, 4)) {
      await prisma.jobCompetency.create({
        data: { companyId, jobPostingId: posting.id, competencyId: competency.id, weight: 1 },
      });
    }

    const applicantCount = int(6, 14);
    for (let i = 0; i < applicantCount; i += 1) {
      candidateSequence += 1;
      const isFemale = chance(0.5);
      const firstName = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
      const lastName = pick(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const email = `candidato${candidateSequence}@correo.com`;

      const candidate = await prisma.candidate.create({
        data: {
          companyId,
          firstName,
          lastName,
          fullName,
          email,
          phone: `3${int(10, 25)}${int(1000000, 9999999)}`,
          documentNumber: String(int(80000000, 1299999999)),
          city: pick(['Barranquilla', 'Bogota', 'Medellin', 'Cartagena', 'Cali']),
          source: pick(['portal', 'portal', 'linkedin', 'referido', 'computrabajo']),
          resumeText: `${fullName}. Profesional con experiencia en ${positionName.toLowerCase()}. Manejo de herramientas ofimaticas, trabajo en equipo, orientacion al cliente y mejora continua. Experiencia previa en empresas del sector servicios.`,
          rating: chance(0.6) ? int(2, 5) : null,
          consentAt: new Date(),
          retentionUntil: addMonths(new Date(), 12),
        },
      });

      // Distribute candidates across the funnel.
      const stageIndex = Math.min(
        DEFAULT_STAGES.length - 3,
        Math.floor(random() * random() * (DEFAULT_STAGES.length - 2)),
      );
      const rejected = chance(0.2);
      const stage = rejected ? stages[stages.length - 1] : stages[stageIndex];

      const application = await prisma.application.create({
        data: {
          companyId,
          jobPostingId: posting.id,
          candidateId: candidate.id,
          stageId: stage.id,
          status: rejected ? 'rejected' : 'active',
          source: candidate.source,
          appliedAt: addDays(new Date(), -int(1, 40)),
          rejectionReason: rejected ? pick(['perfil_no_ajusta', 'expectativa_salarial', 'desistio']) : null,
          rejectedAt: rejected ? addDays(new Date(), -int(1, 20)) : null,
        },
      });

      await prisma.applicationStageHistory.create({
        data: {
          companyId,
          applicationId: application.id,
          toStageId: stages[0].id,
          note: 'Postulacion recibida desde el portal de empleos.',
        },
      });
      if (stageIndex > 0 && !rejected) {
        await prisma.applicationStageHistory.create({
          data: {
            companyId,
            applicationId: application.id,
            fromStageId: stages[0].id,
            toStageId: stage.id,
            note: 'Avanza en el proceso.',
          },
        });
      }

      // Interviews and scorecards for the advanced candidates.
      if (!rejected && stageIndex >= 2) {
        const interview = await prisma.interview.create({
          data: {
            companyId,
            applicationId: application.id,
            title: `Entrevista ${stageIndex >= 4 ? 'con el jefe' : 'de Talento Humano'}`,
            kind: stageIndex >= 4 ? 'manager' : 'hr',
            scheduledAt: addDays(new Date(), int(-10, 7)),
            durationMinutes: 60,
            meetingUrl: 'https://meet.demo.com/entrevista',
            status: chance(0.6) ? 'done' : 'scheduled',
          },
        });
        const interviewer = pick(refs.employees);
        await prisma.interviewParticipant.create({
          data: { companyId, interviewId: interview.id, employeeId: interviewer.id },
        });
        if (interview.status === 'done') {
          const feedback = await prisma.interviewFeedback.create({
            data: {
              companyId,
              interviewId: interview.id,
              reviewerEmployeeId: interviewer.id,
              overallRating: int(3, 5),
              recommendation: pick(['yes', 'strong_yes', 'neutral'] as const),
              strengths: 'Buena comunicacion y experiencia relevante para el cargo.',
              concerns: chance(0.4) ? 'Requiere acompanamiento inicial en herramientas internas.' : null,
            },
          });
          for (const competency of pickMany(refs.competencies, 3)) {
            await prisma.interviewFeedbackRating.create({
              data: {
                companyId,
                feedbackId: feedback.id,
                competencyId: competency.id,
                rating: int(3, 5),
              },
            });
          }
        }
      }
    }
  }

  // An internal referral programme entry.
  const referredCandidate = await prisma.candidate.findFirst({
    where: { companyId, source: 'referido' },
  });
  if (referredCandidate) {
    await prisma.referral.create({
      data: {
        companyId,
        employeeId: pick(refs.employees).id,
        candidateId: referredCandidate.id,
        status: 'in_process',
        rewardNote: 'Bono de referido aplicable al superar el periodo de prueba (registro informativo).',
      },
    });
  }
}

async function createOnboarding(companyId: string, employees: Array<{ id: string; hiredAt: Date }>) {
  const documentTypes = await prisma.documentType.findMany({ where: { companyId } });
  const contractType = documentTypes.find((type) => type.code === 'contrato');

  const onboarding = await prisma.onboardingTemplate.create({
    data: {
      companyId,
      name: 'Ingreso estandar',
      kind: 'onboarding',
      description: 'Plantilla base para cualquier ingreso administrativo.',
      isDefault: true,
    },
  });

  const tasks = [
    { title: 'Enviar documentos de vinculacion', ownerType: 'employee' as const, kind: 'document' as const, offsetDays: -3 },
    { title: 'Firmar contrato de trabajo', ownerType: 'employee' as const, kind: 'document' as const, offsetDays: -1, documentTypeId: contractType?.id },
    { title: 'Crear cuentas y accesos', ownerType: 'it' as const, kind: 'system_access' as const, offsetDays: -1 },
    { title: 'Entregar equipo de computo', ownerType: 'it' as const, kind: 'equipment' as const, offsetDays: 0 },
    { title: 'Bienvenida e induccion corporativa', ownerType: 'hr' as const, kind: 'meeting' as const, offsetDays: 0 },
    { title: 'Presentacion del equipo', ownerType: 'manager' as const, kind: 'meeting' as const, offsetDays: 0 },
    { title: 'Curso obligatorio de SST', ownerType: 'employee' as const, kind: 'course' as const, offsetDays: 3 },
    { title: 'Lectura y firma del reglamento interno', ownerType: 'employee' as const, kind: 'reading' as const, offsetDays: 5 },
    { title: 'Definir objetivos de los primeros 90 dias', ownerType: 'manager' as const, kind: 'generic' as const, offsetDays: 7 },
    { title: 'Seguimiento de 30 dias', ownerType: 'hr' as const, kind: 'meeting' as const, offsetDays: 30 },
    { title: 'Seguimiento de 60 dias', ownerType: 'manager' as const, kind: 'meeting' as const, offsetDays: 60 },
    { title: 'Encuesta de experiencia de ingreso', ownerType: 'employee' as const, kind: 'form' as const, offsetDays: 90 },
  ];
  for (const [index, task] of tasks.entries()) {
    await prisma.onboardingTemplateTask.create({
      data: {
        companyId,
        templateId: onboarding.id,
        title: task.title,
        ownerType: task.ownerType,
        kind: task.kind,
        offsetDays: task.offsetDays,
        position: index,
        documentTypeId: task.documentTypeId ?? null,
      },
    });
  }

  const offboarding = await prisma.onboardingTemplate.create({
    data: {
      companyId,
      name: 'Salida estandar',
      kind: 'offboarding',
      description: 'Checklist de retiro con entrega de activos y paz y salvo.',
      isDefault: true,
    },
  });
  const exitTasks = [
    { title: 'Entrevista de retiro', ownerType: 'hr' as const, offsetDays: -3 },
    { title: 'Devolucion de equipos y activos', ownerType: 'employee' as const, offsetDays: -1 },
    { title: 'Revocacion de accesos y cuentas', ownerType: 'it' as const, offsetDays: 0 },
    { title: 'Paz y salvo del area', ownerType: 'manager' as const, offsetDays: 0 },
    { title: 'Entrega de puesto y documentacion', ownerType: 'employee' as const, offsetDays: -1 },
    { title: 'Carta de retiro y certificacion laboral', ownerType: 'hr' as const, offsetDays: 1 },
  ];
  for (const [index, task] of exitTasks.entries()) {
    await prisma.onboardingTemplateTask.create({
      data: {
        companyId,
        templateId: offboarding.id,
        title: task.title,
        ownerType: task.ownerType,
        kind: 'generic',
        offsetDays: task.offsetDays,
        position: index,
      },
    });
  }

  // Open onboarding processes for the most recent hires.
  const recent = [...employees].sort((a, b) => b.hiredAt.getTime() - a.hiredAt.getTime()).slice(0, 6);
  const templateTasks = await prisma.onboardingTemplateTask.findMany({
    where: { templateId: onboarding.id },
    orderBy: { position: 'asc' },
  });

  for (const employee of recent) {
    const employeeRow = await prisma.employee.findFirst({
      where: { id: employee.id },
      select: { managerId: true },
    });
    const process = await prisma.onboardingProcess.create({
      data: {
        companyId,
        employeeId: employee.id,
        templateId: onboarding.id,
        kind: 'onboarding',
        status: 'in_progress',
        referenceDate: employee.hiredAt,
        startedAt: addDays(employee.hiredAt, -5),
        preboardingToken: `pre-${slugify(employee.id).slice(0, 18)}`,
      },
    });

    let completed = 0;
    for (const task of templateTasks) {
      const dueDate = addDays(employee.hiredAt, task.offsetDays);
      const isDone = dueDate < new Date() && chance(0.75);
      if (isDone) completed += 1;
      await prisma.onboardingTask.create({
        data: {
          companyId,
          processId: process.id,
          title: task.title,
          ownerType: task.ownerType,
          assigneeEmployeeId:
            task.ownerType === 'employee'
              ? employee.id
              : task.ownerType === 'manager'
                ? employeeRow?.managerId ?? null
                : null,
          kind: task.kind,
          status: isDone ? 'completed' : dueDate < new Date() ? 'overdue' : 'pending',
          dueDate,
          position: task.position,
          completedAt: isDone ? dueDate : null,
        },
      });
    }

    await prisma.onboardingProcess.update({
      where: { id: process.id },
      data: { progress: Math.round((completed / templateTasks.length) * 100) },
    });
  }

  // Exit interviews for the former employees.
  const formerEmployees = await prisma.employee.findMany({
    where: { companyId, status: 'inactive', terminatedAt: { not: null } },
    select: { id: true, exitReason: true, terminatedAt: true },
  });
  for (const employee of formerEmployees) {
    await prisma.exitInterview.create({
      data: {
        companyId,
        employeeId: employee.id,
        conductedAt: employee.terminatedAt,
        exitReason: employee.exitReason ?? 'renuncia',
        wouldRecommend: chance(0.7),
        npsScore: int(4, 10),
        summary: pick([
          'Se retira por una oferta con mejor compensacion.',
          'Motivos personales y de traslado de ciudad.',
          'Busca un rol con mayor proyeccion tecnica.',
          'Finaliza el contrato por obra o labor.',
        ]),
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Learning                                                                   */
/* -------------------------------------------------------------------------- */

const COURSES = [
  { title: 'Induccion corporativa Demo S.A.S.', category: 'Induccion', mandatory: true, minutes: 60 },
  { title: 'Seguridad y salud en el trabajo (SST)', category: 'SST', mandatory: true, minutes: 90, recert: 12 },
  { title: 'Prevencion del acoso laboral (Ley 2466)', category: 'Cumplimiento', mandatory: true, minutes: 45, recert: 12 },
  { title: 'Tratamiento de datos personales (Ley 1581)', category: 'Cumplimiento', mandatory: true, minutes: 40, recert: 24 },
  { title: 'Servicio al cliente de alto impacto', category: 'Comercial', minutes: 120 },
  { title: 'Excel intermedio para analisis', category: 'Ofimatica', minutes: 180 },
  { title: 'Comunicacion asertiva', category: 'Habilidades', minutes: 90 },
  { title: 'Liderazgo de equipos hibridos', category: 'Liderazgo', minutes: 150 },
  { title: 'Fundamentos de ciberseguridad', category: 'Tecnologia', minutes: 120, recert: 12 },
  { title: 'Gestion del tiempo y productividad', category: 'Habilidades', minutes: 75 },
];

function lessonBlocks(title: string, withVideo: boolean) {
  const blocks: Array<Record<string, unknown>> = [
    {
      id: `b-${slugify(title)}-h`,
      type: 'heading',
      data: { level: 2, text: title },
    },
    {
      id: `b-${slugify(title)}-p`,
      type: 'paragraph',
      data: {
        html: `En esta leccion revisaremos los conceptos clave de <strong>${title.toLowerCase()}</strong> y como aplicarlos en el dia a dia de Demo S.A.S.`,
      },
    },
    {
      id: `b-${slugify(title)}-c`,
      type: 'callout',
      data: {
        variant: 'info',
        text: 'Recuerde que puede consultar el material de apoyo en la wiki corporativa.',
      },
    },
    {
      id: `b-${slugify(title)}-l`,
      type: 'list',
      data: {
        style: 'bullet',
        items: [
          'Identificar los conceptos fundamentales.',
          'Reconocer situaciones reales del trabajo diario.',
          'Aplicar buenas practicas en su area.',
        ],
      },
    },
  ];
  if (withVideo) {
    blocks.push({
      id: `b-${slugify(title)}-e`,
      type: 'embed',
      required: true,
      data: {
        provider: 'YouTube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Video de apoyo',
      },
    });
  }
  blocks.push({
    id: `b-${slugify(title)}-q`,
    type: 'quickQuestion',
    required: true,
    data: {
      question: 'Confirma que leyo y comprendio el contenido de esta leccion?',
      options: ['Si, lo comprendi', 'Necesito revisarlo de nuevo'],
    },
  });
  return { version: 1, blocks };
}

async function createLearning(
  companyId: string,
  employees: Array<{ id: string; status: string; positionId: string | null }>,
  positions: Array<{ id: string; name: string }>,
) {
  const active = employees.filter((employee) => employee.status === 'active');
  const createdCourses = [];

  for (const definition of COURSES) {
    const course = await prisma.course.create({
      data: {
        companyId,
        title: definition.title,
        slug: slugify(definition.title),
        summary: `Curso de ${definition.category.toLowerCase()} orientado a fortalecer las competencias del equipo.`,
        category: definition.category,
        kind: 'internal',
        status: 'published',
        estimatedMinutes: definition.minutes,
        isMandatory: definition.mandatory ?? false,
        recertificationMonths: definition.recert ?? null,
        passingScore: 70,
        publishedAt: addDays(new Date(), -int(30, 300)),
        tags: [definition.category.toLowerCase()],
      },
    });

    for (let moduleIndex = 0; moduleIndex < 2; moduleIndex += 1) {
      const module = await prisma.courseModule.create({
        data: {
          companyId,
          courseId: course.id,
          title: moduleIndex === 0 ? 'Fundamentos' : 'Aplicacion practica',
          position: moduleIndex,
        },
      });
      for (let lessonIndex = 0; lessonIndex < 2; lessonIndex += 1) {
        const title = `${module.title} - parte ${lessonIndex + 1}`;
        const lesson = await prisma.lesson.create({
          data: {
            companyId,
            moduleId: module.id,
            title,
            kind: 'content',
            estimatedMinutes: Math.round(definition.minutes / 4),
            position: lessonIndex,
          },
        });
        const blocks = lessonBlocks(title, lessonIndex === 0);
        await prisma.lessonContent.create({
          data: {
            companyId,
            lessonId: lesson.id,
            blocks: blocks as Prisma.InputJsonValue,
            version: 1,
            isPublished: true,
            publishedAt: new Date(),
          },
        });
        await prisma.lessonContentVersion.create({
          data: {
            companyId,
            lessonId: lesson.id,
            version: 1,
            blocks: blocks as Prisma.InputJsonValue,
            changeNote: 'Version inicial',
          },
        });
      }
    }

    // Final quiz on the last lesson of the course.
    const lastLesson = await prisma.lesson.findFirst({
      where: { companyId, module: { courseId: course.id } },
      orderBy: { createdAt: 'desc' },
    });
    if (lastLesson) {
      const quiz = await prisma.quiz.create({
        data: {
          companyId,
          lessonId: lastLesson.id,
          title: `Evaluacion final - ${definition.title}`,
          passingScore: 70,
          maxAttempts: 3,
        },
      });
      const questions = [
        {
          text: `Cual es el objetivo principal del curso "${definition.title}"?`,
          options: [
            { text: 'Fortalecer las competencias del equipo en el tema', isCorrect: true },
            { text: 'Cumplir un tramite administrativo', isCorrect: false },
            { text: 'Reemplazar la induccion del area', isCorrect: false },
          ],
        },
        {
          text: 'Quien es responsable de aplicar lo aprendido en el puesto de trabajo?',
          options: [
            { text: 'Cada colaborador con el apoyo de su jefe', isCorrect: true },
            { text: 'Solo el area de Talento Humano', isCorrect: false },
            { text: 'Un proveedor externo', isCorrect: false },
          ],
        },
        {
          text: 'Con que frecuencia se debe revisar este contenido?',
          options: [
            { text: 'Segun la politica de recertificacion de la empresa', isCorrect: true },
            { text: 'Nunca mas', isCorrect: false },
            { text: 'Solo si hay una auditoria', isCorrect: false },
          ],
        },
      ];
      for (const [index, question] of questions.entries()) {
        const created = await prisma.question.create({
          data: {
            companyId,
            quizId: quiz.id,
            text: question.text,
            type: 'single_choice',
            points: 1,
            position: index,
          },
        });
        for (const [optionIndex, option] of question.options.entries()) {
          await prisma.questionOption.create({
            data: {
              companyId,
              questionId: created.id,
              text: option.text,
              isCorrect: option.isCorrect,
              position: optionIndex,
            },
          });
        }
      }
    }

    createdCourses.push(course);
  }

  // Mandatory courses go to everybody; the rest to a sample.
  let certificateSequence = 0;
  for (const course of createdCourses) {
    const audience = course.isMandatory ? active : pickMany(active, Math.round(active.length * 0.4));
    for (const employee of audience) {
      const roll = random();
      const status = roll < 0.55 ? 'completed' : roll < 0.8 ? 'in_progress' : 'assigned';
      const completedAt = status === 'completed' ? addDays(new Date(), -int(5, 200)) : null;

      const enrollment = await prisma.enrollment.create({
        data: {
          companyId,
          courseId: course.id,
          employeeId: employee.id,
          status,
          progress: status === 'completed' ? 100 : status === 'in_progress' ? int(20, 80) : 0,
          score: status === 'completed' ? new Prisma.Decimal(int(70, 100)) : null,
          dueDate: course.isMandatory ? addDays(new Date(), int(-20, 60)) : null,
          startedAt: status === 'assigned' ? null : addDays(completedAt ?? new Date(), -int(2, 20)),
          completedAt,
          expiresAt:
            completedAt && course.recertificationMonths
              ? addMonths(completedAt, course.recertificationMonths)
              : null,
          timeSpentMinutes: status === 'assigned' ? 0 : int(20, course.estimatedMinutes),
          source: course.isMandatory ? 'rule' : 'manual',
        },
      });

      if (status === 'completed') {
        certificateSequence += 1;
        await prisma.certificate.create({
          data: {
            companyId,
            employeeId: employee.id,
            courseId: course.id,
            enrollmentId: enrollment.id,
            title: `Certificado - ${course.title}`,
            code: `CERT-${String(certificateSequence).padStart(6, '0')}`,
            issuedAt: completedAt!,
            expiresAt: enrollment.expiresAt,
            score: enrollment.score,
          },
        });
        if (chance(0.5)) {
          await prisma.courseFeedback.create({
            data: {
              companyId,
              courseId: course.id,
              employeeId: employee.id,
              enrollmentId: enrollment.id,
              rating: int(3, 5),
              comment: pick([
                'Contenido claro y aplicable.',
                'Buen material, me gustaria mas ejemplos practicos.',
                'Excelente curso, muy util para el dia a dia.',
                'Se entiende bien, aunque es un poco extenso.',
              ]),
            },
          });
        }
      }
    }
  }

  // Learning path for a critical role.
  const seniorDeveloper = positions.find((p) => p.name === 'Desarrollador Senior');
  if (seniorDeveloper) {
    const path = await prisma.learningPath.create({
      data: {
        companyId,
        name: 'Ruta tecnica: Desarrollador Senior',
        description: 'Formacion obligatoria y recomendada para el rol de desarrollo senior.',
        positionId: seniorDeveloper.id,
        isMandatory: true,
      },
    });
    const pathCourses = createdCourses.filter((course) =>
      ['SST', 'Cumplimiento', 'Tecnologia'].includes(course.category ?? ''),
    );
    for (const [index, course] of pathCourses.entries()) {
      await prisma.learningPathItem.create({
        data: { companyId, pathId: path.id, courseId: course.id, position: index, dueDays: 30 * (index + 1) },
      });
    }
  }

  // Live sessions.
  const inductionCourse = createdCourses[0];
  for (let i = 0; i < 3; i += 1) {
    const startsAt = addDays(new Date(), int(-20, 25));
    await prisma.trainingSession.create({
      data: {
        companyId,
        courseId: inductionCourse.id,
        title: `Induccion corporativa - grupo ${i + 1}`,
        modality: i === 2 ? 'virtual' : 'onsite',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3 * 3_600_000),
        locationText: i === 2 ? null : 'Auditorio sede principal',
        meetingUrl: i === 2 ? 'https://meet.demo.com/induccion' : null,
        capacity: 25,
        attendanceToken: `ses-${i + 1}-${slugify(companyId).slice(0, 8)}`,
        status: startsAt < new Date() ? 'done' : 'scheduled',
      },
    });
  }

  // Annual training plan with detected needs.
  const plan = await prisma.trainingPlan.create({
    data: {
      companyId,
      year: new Date().getUTCFullYear(),
      name: `Plan anual de capacitacion ${new Date().getUTCFullYear()}`,
      status: 'active',
      budget: new Prisma.Decimal(48_000_000),
      executedCost: new Prisma.Decimal(19_500_000),
      notes: 'Presupuesto informativo; la plataforma no ejecuta contabilidad.',
    },
  });
  for (const need of [
    'Refuerzo en analisis de datos para el area comercial',
    'Liderazgo para coordinadores nuevos',
    'Actualizacion normativa en SST',
    'Ingles conversacional para servicio al cliente',
  ]) {
    await prisma.trainingNeed.create({
      data: {
        companyId,
        planId: plan.id,
        title: need,
        source: pick(['performance_review', 'competency_gap', 'manual']),
        employeeCount: int(4, 25),
        priority: pick(['high', 'medium', 'low']),
        estimatedCost: new Prisma.Decimal(int(2_000_000, 12_000_000)),
        status: pick(['detected', 'planned', 'in_progress']),
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Performance                                                                */
/* -------------------------------------------------------------------------- */

async function createPerformance(
  companyId: string,
  employees: Array<{ id: string; status: string; level: string | null; departmentId: string | null }>,
  competencies: Array<{ id: string; name: string }>,
) {
  const active = employees.filter((employee) => employee.status === 'active');
  const year = new Date().getUTCFullYear();

  const cycle = await prisma.objectiveCycle.create({
    data: {
      companyId,
      name: `OKR ${year}`,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
      status: 'active',
    },
  });

  const companyObjectives = [
    'Incrementar la satisfaccion del cliente',
    'Fortalecer la cultura y el clima organizacional',
    'Mejorar la eficiencia operativa',
  ];
  const parents = [];
  for (const title of companyObjectives) {
    const objective = await prisma.objective.create({
      data: {
        companyId,
        cycleId: cycle.id,
        title,
        description: `Objetivo estrategico de la compania para ${year}.`,
        level: 'company',
        status: 'active',
        weight: new Prisma.Decimal(100),
        startDate: new Date(Date.UTC(year, 0, 1)),
        dueDate: new Date(Date.UTC(year, 11, 31)),
      },
    });
    for (let i = 0; i < 3; i += 1) {
      const target = int(80, 100);
      const current = int(30, target);
      await prisma.keyResult.create({
        data: {
          companyId,
          objectiveId: objective.id,
          title: pick([
            'Alcanzar un NPS de clientes superior a 45',
            'Reducir el tiempo de respuesta en 30%',
            'Cerrar el 90% de las acciones del plan',
            'Aumentar el eNPS a 40 puntos',
            'Disminuir la rotacion voluntaria al 8%',
          ]),
          metric: pick(['porcentaje', 'puntos', 'dias']),
          startValue: new Prisma.Decimal(0),
          targetValue: new Prisma.Decimal(target),
          currentValue: new Prisma.Decimal(current),
          weight: new Prisma.Decimal(100 / 3),
          confidence: pick(['on_track', 'on_track', 'at_risk'] as const),
          position: i,
        },
      });
    }
    await prisma.objective.update({
      where: { id: objective.id },
      data: { progress: new Prisma.Decimal(int(35, 85)) },
    });
    parents.push(objective);
  }

  // Individual objectives for a representative sample.
  for (const employee of pickMany(active, Math.min(60, active.length))) {
    const objective = await prisma.objective.create({
      data: {
        companyId,
        cycleId: cycle.id,
        parentId: pick(parents).id,
        title: pick([
          'Mejorar los indicadores de mi proceso',
          'Documentar y estandarizar mis actividades',
          'Completar el plan de formacion del ano',
          'Reducir reprocesos en mi area',
          'Acompanar la implementacion de una mejora',
        ]),
        level: 'individual',
        ownerEmployeeId: employee.id,
        departmentId: employee.departmentId,
        status: 'active',
        weight: new Prisma.Decimal(100),
        progress: new Prisma.Decimal(int(10, 95)),
        startDate: new Date(Date.UTC(year, 0, 1)),
        dueDate: new Date(Date.UTC(year, 11, 31)),
      },
    });
    const keyResult = await prisma.keyResult.create({
      data: {
        companyId,
        objectiveId: objective.id,
        title: 'Avance medible del objetivo',
        metric: 'porcentaje',
        startValue: new Prisma.Decimal(0),
        targetValue: new Prisma.Decimal(100),
        currentValue: new Prisma.Decimal(int(10, 95)),
        weight: new Prisma.Decimal(100),
      },
    });
    if (chance(0.6)) {
      await prisma.krCheckin.create({
        data: {
          companyId,
          keyResultId: keyResult.id,
          value: keyResult.currentValue,
          confidence: pick(['on_track', 'at_risk'] as const),
          comment: 'Avance reportado en el check-in mensual.',
        },
      });
    }
  }

  // 360 review cycle in progress.
  const template = await prisma.reviewTemplate.create({
    data: {
      companyId,
      name: 'Formulario 360 estandar',
      description: 'Competencias organizacionales, objetivos y preguntas abiertas.',
      scaleMin: 1,
      scaleMax: 5,
      schema: {
        title: 'Evaluacion de desempeno 360',
        fields: [
          ...competencies.slice(0, 6).map((competency) => ({
            key: `comp_${competency.id.slice(0, 8)}`,
            type: 'likert',
            label: competency.name,
            dimension: 'Competencias',
            required: true,
            competencyId: competency.id,
            scaleLabels: ['Muy bajo', 'Bajo', 'Esperado', 'Alto', 'Sobresaliente'],
          })),
          { key: 'fortalezas', type: 'textarea', label: 'Principales fortalezas observadas' },
          { key: 'mejoras', type: 'textarea', label: 'Oportunidades de mejora' },
        ],
      } as Prisma.InputJsonValue,
    },
  });

  const reviewCycle = await prisma.reviewCycle.create({
    data: {
      companyId,
      name: `Evaluacion 360 - ${year}`,
      type: 'three_sixty',
      templateId: template.id,
      objectiveCycleId: cycle.id,
      status: 'evaluation',
      selfStart: addDays(new Date(), -25),
      selfEnd: addDays(new Date(), -15),
      evalStart: addDays(new Date(), -14),
      evalEnd: addDays(new Date(), 10),
      calibrationDate: addDays(new Date(), 20),
      anonymousPeers: true,
      anonymousReports: true,
      instructions:
        'Responda con honestidad y con base en hechos observables. Las respuestas de pares y reportes son anonimas.',
    },
  });

  const subjects = pickMany(active, Math.min(40, active.length));
  const byId = new Map(active.map((employee) => [employee.id, employee]));
  const allRows = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: 'active' },
    select: { id: true, managerId: true, departmentId: true },
  });
  const managerOf = new Map(allRows.map((row) => [row.id, row.managerId]));

  const questionKeys = competencies.slice(0, 6).map((competency) => ({
    key: `comp_${competency.id.slice(0, 8)}`,
    competencyId: competency.id,
  }));

  for (const subject of subjects) {
    const reviewers: Array<{ id: string; relation: 'self' | 'manager' | 'peer' | 'direct_report' }> = [
      { id: subject.id, relation: 'self' },
    ];
    const managerId = managerOf.get(subject.id);
    if (managerId && byId.has(managerId)) reviewers.push({ id: managerId, relation: 'manager' });

    const peers = allRows
      .filter((row) => row.id !== subject.id && row.departmentId === subject.departmentId)
      .slice(0, 3);
    for (const peer of peers) reviewers.push({ id: peer.id, relation: 'peer' });

    const reports = allRows.filter((row) => row.managerId === subject.id).slice(0, 2);
    for (const report of reports) reviewers.push({ id: report.id, relation: 'direct_report' });

    for (const reviewer of reviewers) {
      const submitted = chance(0.62);
      const assignment = await prisma.reviewAssignment.create({
        data: {
          companyId,
          cycleId: reviewCycle.id,
          subjectEmployeeId: subject.id,
          reviewerEmployeeId: reviewer.id,
          relationType: reviewer.relation,
          status: submitted ? 'submitted' : 'pending',
          submittedAt: submitted ? addDays(new Date(), -int(1, 12)) : null,
        },
      });

      if (!submitted) continue;

      let sum = 0;
      for (const question of questionKeys) {
        const rating = int(3, 5);
        sum += rating;
        await prisma.reviewResponse.create({
          data: {
            companyId,
            assignmentId: assignment.id,
            questionKey: question.key,
            competencyId: question.competencyId,
            rating: new Prisma.Decimal(rating),
          },
        });
      }
      await prisma.reviewResponse.create({
        data: {
          companyId,
          assignmentId: assignment.id,
          questionKey: 'fortalezas',
          comment: pick([
            'Gran disposicion para apoyar al equipo.',
            'Cumple con los compromisos en los tiempos acordados.',
            'Aporta ideas para mejorar los procesos.',
          ]),
        },
      });
      await prisma.reviewResponse.create({
        data: {
          companyId,
          assignmentId: assignment.id,
          questionKey: 'mejoras',
          comment: pick([
            'Puede fortalecer la comunicacion con otras areas.',
            'Le ayudaria delegar con mayor frecuencia.',
            'Profundizar en el conocimiento tecnico del rol.',
          ]),
        },
      });
      await prisma.reviewAssignment.update({
        where: { id: assignment.id },
        data: { overallScore: new Prisma.Decimal((sum / questionKeys.length).toFixed(2)) },
      });
    }

    if (chance(0.5)) {
      const performance = int(1, 3);
      const potential = int(1, 3);
      await prisma.nineBoxPlacement.create({
        data: {
          companyId,
          cycleId: reviewCycle.id,
          employeeId: subject.id,
          performance,
          potential,
          box: (potential - 1) * 3 + performance,
          notes: 'Ubicacion preliminar, pendiente de calibracion.',
        },
      });
    }
  }

  await prisma.calibrationSession.create({
    data: {
      companyId,
      cycleId: reviewCycle.id,
      name: 'Calibracion general de directores',
      scheduledAt: addDays(new Date(), 20),
      status: 'planned',
      notes: 'Revisar la distribucion por area y ajustar los casos limite.',
    },
  });

  // Continuous feedback and 1:1 meetings.
  for (let i = 0; i < 40; i += 1) {
    const from = pick(active);
    const to = pick(active.filter((employee) => employee.id !== from.id));
    await prisma.feedback.create({
      data: {
        companyId,
        fromEmployeeId: from.id,
        toEmployeeId: to.id,
        kind: pick(['praise', 'suggestion', 'general'] as const),
        visibility: pick(['public', 'private', 'manager_only'] as const),
        message: pick([
          'Excelente manejo de la situacion con el cliente, gracias por el apoyo.',
          'Sugiero documentar el procedimiento para que todo el equipo lo pueda replicar.',
          'Tu aporte en la reunion de ayer ayudo a desbloquear el proyecto.',
          'Seria util anticipar los tiempos de entrega para coordinar mejor.',
        ]),
        competencyId: chance(0.5) ? pick(competencies).id : null,
      },
    });
  }

  for (const leader of active.filter((employee) => ['Directivo', 'Coordinacion', 'Liderazgo'].includes(employee.level ?? ''))) {
    const reports = allRows.filter((row) => row.managerId === leader.id).slice(0, 4);
    for (const report of reports) {
      await prisma.oneOnOne.create({
        data: {
          companyId,
          leadEmployeeId: leader.id,
          memberEmployeeId: report.id,
          scheduledAt: addDays(new Date(), int(-20, 14)),
          status: chance(0.6) ? 'done' : 'scheduled',
          agenda: 'Avance de objetivos, cargas de trabajo y desarrollo.',
          agreements: chance(0.6) ? 'Revisar el plan de formacion en la proxima sesion.' : null,
        },
      });
    }
  }

  // Development plans linked to competency gaps.
  for (const employee of pickMany(active, 20)) {
    const plan = await prisma.developmentPlan.create({
      data: {
        companyId,
        employeeId: employee.id,
        title: 'Plan de desarrollo individual',
        scopeKind: 'individual',
        cycleId: reviewCycle.id,
        status: 'active',
        startDate: addDays(new Date(), -30),
        dueDate: addDays(new Date(), 150),
        summary: 'Acciones derivadas de la evaluacion de desempeno y las brechas de competencias.',
      },
    });
    for (let i = 0; i < int(2, 4); i += 1) {
      await prisma.developmentAction.create({
        data: {
          companyId,
          planId: plan.id,
          title: pick([
            'Completar el curso de comunicacion asertiva',
            'Acompanar a un par en un proyecto transversal',
            'Liderar una reunion de equipo al mes',
            'Documentar dos procedimientos del area',
          ]),
          competencyId: pick(competencies).id,
          dueDate: addDays(new Date(), int(30, 150)),
          status: pick(['pending', 'in_progress', 'completed'] as const),
          progress: int(0, 100),
        },
      });
    }
  }

  // Career paths and succession for critical positions.
  const positions = await prisma.position.findMany({ where: { companyId }, select: { id: true, name: true, level: true } });
  const careerPath = await prisma.careerPath.create({
    data: {
      companyId,
      name: 'Ruta de carrera: Tecnologia',
      description: 'Progresion natural dentro del area de tecnologia.',
    },
  });
  const techLadder = ['Desarrollador Junior', 'Desarrollador Senior', 'Lider Tecnico', 'Director de Tecnologia'];
  for (const [index, name] of techLadder.entries()) {
    const position = positions.find((p) => p.name === name);
    if (!position) continue;
    await prisma.careerPathStep.create({
      data: {
        companyId,
        pathId: careerPath.id,
        positionId: position.id,
        position: index,
        minYears: new Prisma.Decimal(index * 2),
        requirements: 'Cumplir el perfil de competencias del cargo y los resultados esperados.',
      },
    });
  }

  for (const name of ['Director de Tecnologia', 'Director Comercial', 'Gerente General']) {
    const position = positions.find((p) => p.name === name);
    if (!position) continue;
    const incumbent = await prisma.employee.findFirst({
      where: { companyId, positionId: position.id, status: 'active' },
      select: { id: true },
    });
    const plan = await prisma.successionPlan.create({
      data: {
        companyId,
        positionId: position.id,
        incumbentEmployeeId: incumbent?.id ?? null,
        criticality: 'high',
        riskOfLoss: pick(['low', 'medium', 'high']),
        notes: 'Cargo critico para la continuidad del negocio.',
      },
    });
    for (const candidate of pickMany(active, 2)) {
      await prisma.successionCandidate.create({
        data: {
          companyId,
          planId: plan.id,
          employeeId: candidate.id,
          readiness: pick(['ready_now', '1_2_years', '3_5_years']),
          notes: 'Requiere fortalecer competencias de liderazgo estrategico.',
        },
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Culture, surveys, ethics, help desk and SST                                */
/* -------------------------------------------------------------------------- */

function postBlocks(paragraphs: string[]) {
  return {
    version: 1,
    blocks: paragraphs.map((text, index) => ({
      id: `p-${index}`,
      type: 'paragraph',
      data: { html: text },
    })),
  };
}

async function createCommunication(
  companyId: string,
  employees: Array<{ id: string; status: string }>,
  values: Array<{ id: string; name: string }>,
) {
  const active = employees.filter((employee) => employee.status === 'active');
  const users = await prisma.user.findMany({
    where: { companyUsers: { some: { companyId } } },
    select: { id: true },
    take: 200,
  });

  const posts = [
    {
      title: 'Resultados del trimestre y proximos retos',
      kind: 'news',
      excerpt: 'Cerramos el trimestre con crecimiento en las tres lineas de negocio.',
      paragraphs: [
        'Queremos compartir con todo el equipo los resultados del trimestre, que muestran un crecimiento sostenido en nuestras tres lineas de negocio.',
        'Agradecemos el compromiso de cada area. Los proximos meses estaran enfocados en la experiencia del cliente y en la eficiencia operativa.',
      ],
      requiresAck: false,
      isPinned: true,
    },
    {
      title: 'Actualizacion del reglamento interno de trabajo',
      kind: 'announcement',
      excerpt: 'Requiere lectura y confirmacion de todo el personal.',
      paragraphs: [
        'Se actualizo el reglamento interno de trabajo con los ajustes derivados de la normativa vigente sobre prevencion del acoso laboral.',
        'Le pedimos leer el documento completo y confirmar su lectura desde el portal antes del cierre de mes.',
      ],
      requiresAck: true,
      isPinned: true,
    },
    {
      title: 'Jornada de bienestar y salud',
      kind: 'event',
      excerpt: 'Examenes gratuitos, actividad fisica y charlas de nutricion.',
      paragraphs: [
        'El proximo viernes realizaremos la jornada de bienestar y salud en la sede principal, de 8:00 a.m. a 4:00 p.m.',
        'Habra tamizaje visual, valoracion nutricional y actividades de pausa activa. La inscripcion se realiza desde el modulo de eventos.',
      ],
      requiresAck: false,
      isPinned: false,
    },
    {
      title: 'Nuevos ingresos del mes',
      kind: 'news',
      excerpt: 'Damos la bienvenida a las personas que se suman al equipo.',
      paragraphs: [
        'Este mes damos la bienvenida a nuevas personas en las areas de Tecnologia, Comercial y Operaciones.',
        'Los invitamos a acercarse, presentarse y apoyarlos en su proceso de adaptacion.',
      ],
      requiresAck: false,
      isPinned: false,
    },
    {
      title: 'Apertura de la encuesta de clima laboral',
      kind: 'announcement',
      excerpt: 'Su opinion es anonima y nos ayuda a mejorar.',
      paragraphs: [
        'Ya esta abierta la encuesta anual de clima laboral. Las respuestas son completamente anonimas y se analizan de forma agregada.',
        'Los resultados por area solo se muestran cuando hay al menos cinco respuestas, para proteger el anonimato.',
      ],
      requiresAck: false,
      isPinned: false,
    },
  ];

  for (const [index, definition] of posts.entries()) {
    const post = await prisma.post.create({
      data: {
        companyId,
        title: definition.title,
        kind: definition.kind,
        blocks: postBlocks(definition.paragraphs) as Prisma.InputJsonValue,
        excerpt: definition.excerpt,
        status: 'published',
        isPinned: definition.isPinned,
        requiresAck: definition.requiresAck,
        publishedAt: addDays(new Date(), -int(1, 40)),
        viewCount: int(30, 250),
      },
    });
    await prisma.postAudience.create({
      data: { companyId, postId: post.id, targetType: 'all', targetId: null },
    });

    for (const user of pickMany(users, int(20, Math.min(90, users.length)))) {
      await prisma.postRead.create({
        data: {
          companyId,
          postId: post.id,
          userId: user.id,
          readAt: addDays(new Date(), -int(0, 20)),
          acknowledgedAt: definition.requiresAck && chance(0.7) ? addDays(new Date(), -int(0, 18)) : null,
        },
      });
    }
    for (const user of pickMany(users, int(5, 30))) {
      await prisma.postReaction.create({
        data: { companyId, postId: post.id, userId: user.id, emoji: pick(['like', 'celebrate', 'heart']) },
      });
    }
    if (index < 3) {
      for (const user of pickMany(users, int(1, 4))) {
        await prisma.postComment.create({
          data: {
            companyId,
            postId: post.id,
            userId: user.id,
            body: pick([
              'Excelente noticia, felicitaciones al equipo.',
              'Gracias por la informacion, muy clara.',
              'Quedo atento a los detalles.',
              'Me parece una gran iniciativa.',
            ]),
          },
        });
      }
    }
  }

  // Events with registrations.
  const events = [
    { title: 'Jornada de bienestar y salud', kind: 'bienestar', days: 7 },
    { title: 'Celebracion de fin de ano', kind: 'cultura', days: 45 },
    { title: 'Torneo interno de futbol', kind: 'bienestar', days: 21 },
  ];
  for (const definition of events) {
    const event = await prisma.companyEvent.create({
      data: {
        companyId,
        title: definition.title,
        kind: definition.kind,
        description: `${definition.title} organizada por el area de Talento Humano.`,
        startsAt: addDays(new Date(), definition.days),
        endsAt: addDays(new Date(), definition.days),
        locationText: 'Sede principal Barranquilla',
        capacity: 120,
        requiresRegistration: true,
      },
    });
    for (const employee of pickMany(active, int(15, 50))) {
      await prisma.eventRegistration.create({
        data: { companyId, eventId: event.id, employeeId: employee.id },
      });
    }
  }

  // Recognitions.
  for (let i = 0; i < 60; i += 1) {
    const from = pick(active);
    const to = pick(active.filter((employee) => employee.id !== from.id));
    await prisma.recognition.create({
      data: {
        companyId,
        fromEmployeeId: from.id,
        toEmployeeId: to.id,
        valueId: pick(values).id,
        message: pick([
          'Gracias por quedarte apoyando el cierre del proyecto.',
          'Tu actitud con el cliente marco la diferencia.',
          'Excelente trabajo en equipo durante la contingencia.',
          'Gracias por compartir tu conocimiento con el area.',
          'Tu propuesta nos ayudo a simplificar el proceso.',
        ]),
        points: pick([10, 20, 30]),
        createdAt: addDays(new Date(), -int(1, 120)),
      },
    });
  }

  const badges = [
    { name: 'Colaborador del mes', pointsRequired: 100, icon: 'Star' },
    { name: 'Mentor', pointsRequired: 200, icon: 'GraduationCap' },
    { name: 'Innovador', pointsRequired: 150, icon: 'Lightbulb' },
  ];
  for (const badge of badges) {
    const created = await prisma.badge.create({ data: { companyId, ...badge } });
    for (const employee of pickMany(active, 3)) {
      await prisma.employeeBadge.create({
        data: {
          companyId,
          employeeId: employee.id,
          badgeId: created.id,
          reason: 'Reconocimiento otorgado por Talento Humano.',
        },
      });
    }
  }

  // Benefits catalogue.
  const benefits = [
    { name: 'Convenio con gimnasios', category: 'Bienestar', provider: 'SmartFit' },
    { name: 'Descuento en universidad', category: 'Educacion', provider: 'Universidad del Norte' },
    { name: 'Poliza de salud complementaria', category: 'Salud', provider: 'Seguros Bolivar' },
    { name: 'Dia libre de cumpleanos', category: 'Tiempo', provider: null },
    { name: 'Auxilio de conectividad', category: 'Trabajo remoto', provider: null },
  ];
  for (const benefit of benefits) {
    const created = await prisma.benefit.create({
      data: {
        companyId,
        name: benefit.name,
        category: benefit.category,
        provider: benefit.provider,
        description: `${benefit.name} disponible para todos los colaboradores con contrato vigente.`,
        requiresEnrollment: chance(0.6),
        validFrom: addDays(new Date(), -120),
        validTo: addDays(new Date(), 245),
      },
    });
    if (created.requiresEnrollment) {
      for (const employee of pickMany(active, int(5, 25))) {
        await prisma.benefitEnrollment.create({
          data: {
            companyId,
            benefitId: created.id,
            employeeId: employee.id,
            status: pick(['requested', 'approved', 'approved']),
          },
        });
      }
    }
  }

  // Wiki.
  const categories = ['Politicas', 'Procesos', 'Talento Humano', 'Tecnologia'];
  const wikiCategories = [];
  for (const [index, name] of categories.entries()) {
    wikiCategories.push(
      await prisma.wikiCategory.create({
        data: { companyId, name, slug: slugify(name), position: index },
      }),
    );
  }
  const articles = [
    { title: 'Como solicitar vacaciones', category: 'Talento Humano' },
    { title: 'Politica de trabajo hibrido', category: 'Politicas' },
    { title: 'Proceso de compras y proveedores', category: 'Procesos' },
    { title: 'Solicitud de soporte tecnico', category: 'Tecnologia' },
    { title: 'Codigo de etica y conducta', category: 'Politicas' },
    { title: 'Guia del nuevo colaborador', category: 'Talento Humano' },
  ];
  for (const article of articles) {
    const category = wikiCategories.find((c) => c.name === article.category);
    await prisma.wikiArticle.create({
      data: {
        companyId,
        categoryId: category?.id ?? null,
        title: article.title,
        slug: slugify(article.title),
        summary: `Documento de referencia sobre ${article.title.toLowerCase()}.`,
        blocks: postBlocks([
          `Este articulo describe paso a paso ${article.title.toLowerCase()} en Demo S.A.S.`,
          'Si tiene dudas adicionales puede abrir un ticket en el centro de ayuda del portal.',
        ]) as Prisma.InputJsonValue,
        status: 'published',
        publishedAt: addDays(new Date(), -int(10, 200)),
        viewCount: int(20, 400),
        tags: [slugify(article.category)],
      },
    });
  }
}

async function createSurveys(
  companyId: string,
  employees: Array<{ id: string; status: string; departmentId: string | null; locationId: string | null; hiredAt: Date }>,
  departments: Array<{ id: string; name: string }>,
  /**
   * La cuenta `empleado@demo.com` siempre queda con una encuesta por
   * responder: quien explora la demo espera encontrar algo que hacer, y el
   * flujo de respuesta se puede recorrer sin preparar datos a mano.
   */
  demoEmployeeId: string | null = null,
) {
  const active = employees.filter((employee) => employee.status === 'active');
  const templates = await prisma.surveyTemplate.findMany({ where: { companyId: null } });

  const definitions = [
    { key: 'clima_laboral', title: `Encuesta de clima laboral ${new Date().getUTCFullYear()}`, kind: 'climate', response: 0.72 },
    { key: 'enps', title: 'eNPS trimestral', kind: 'enps', response: 0.65 },
  ];

  for (const definition of definitions) {
    const template = templates.find((t) => t.key === definition.key);
    if (!template) continue;

    const schema = template.schema as { fields: Array<{ key: string; type: string; label: string; dimension?: string }> };

    const survey = await prisma.survey.create({
      data: {
        companyId,
        title: definition.title,
        description: 'Sus respuestas son anonimas y se analizan de forma agregada.',
        kind: definition.kind,
        status: 'open',
        isAnonymous: true,
        minSegmentResponses: 5,
        opensAt: addDays(new Date(), -20),
        closesAt: addDays(new Date(), 10),
      },
    });

    const version = await prisma.surveyVersion.create({
      data: { companyId, surveyId: survey.id, version: 1, schema: template.schema as Prisma.InputJsonValue },
    });
    await prisma.survey.update({ where: { id: survey.id }, data: { currentVersionId: version.id } });
    await prisma.surveyAudience.create({
      data: { companyId, surveyId: survey.id, targetType: 'all', targetId: null },
    });

    const questions = [];
    for (const [index, field] of schema.fields.entries()) {
      questions.push(
        await prisma.surveyQuestion.create({
          data: {
            companyId,
            versionId: version.id,
            key: field.key,
            label: field.label,
            type: field.type,
            dimension: field.dimension ?? null,
            position: index,
            isRequired: field.type !== 'textarea',
            config: field as Prisma.InputJsonValue,
          },
        }),
      );
    }

    const departmentName = new Map(departments.map((d) => [d.id, d.name]));

    for (const employee of active) {
      const segment = {
        departmentId: employee.departmentId,
        department: employee.departmentId ? departmentName.get(employee.departmentId) : null,
        locationId: employee.locationId,
      };
      const invitation = await prisma.surveyInvitation.create({
        data: {
          companyId,
          surveyId: survey.id,
          employeeId: employee.id,
          token: `inv-${survey.id.slice(0, 8)}-${employee.id.slice(0, 8)}`,
          sentAt: addDays(new Date(), -18),
          segment: segment as Prisma.InputJsonValue,
        },
      });

      if (employee.id === demoEmployeeId || !chance(definition.response)) continue;

      const response = await prisma.surveyResponse.create({
        data: {
          companyId,
          surveyId: survey.id,
          versionId: version.id,
          // Anonymous: the employee id is deliberately not stored.
          employeeId: null,
          segment: segment as Prisma.InputJsonValue,
          isComplete: true,
          submittedAt: addDays(new Date(), -int(1, 15)),
        },
      });
      await prisma.surveyInvitation.update({
        where: { id: invitation.id },
        data: { respondedAt: new Date(), openedAt: addDays(new Date(), -int(2, 16)) },
      });

      for (const question of questions) {
        if (question.type === 'likert') {
          const value = int(3, 5);
          await prisma.surveyAnswer.create({
            data: {
              companyId,
              responseId: response.id,
              questionId: question.id,
              questionKey: question.key,
              value: value as unknown as Prisma.InputJsonValue,
              numericValue: new Prisma.Decimal(value),
            },
          });
        } else if (question.type === 'nps') {
          const value = chance(0.55) ? int(9, 10) : chance(0.6) ? int(7, 8) : int(0, 6);
          await prisma.surveyAnswer.create({
            data: {
              companyId,
              responseId: response.id,
              questionId: question.id,
              questionKey: question.key,
              value: value as unknown as Prisma.InputJsonValue,
              numericValue: new Prisma.Decimal(value),
            },
          });
        } else if (chance(0.45)) {
          const text = pick([
            'Me gustaria mas oportunidades de formacion.',
            'El ambiente de trabajo es bueno y el equipo colabora.',
            'Mejorar la comunicacion entre areas.',
            'Reconocer mas el trabajo bien hecho.',
            'Flexibilidad horaria seria un gran beneficio.',
            'Necesitamos mejores herramientas de trabajo.',
          ]);
          await prisma.surveyAnswer.create({
            data: {
              companyId,
              responseId: response.id,
              questionId: question.id,
              questionKey: question.key,
              value: text as unknown as Prisma.InputJsonValue,
              textValue: text,
            },
          });
        }
      }
    }
  }
}

async function createEthics(companyId: string) {
  const categories = await prisma.ethicsCategory.findMany({ where: { companyId } });
  const officer = await prisma.user.findFirst({ where: { email: 'etica@demo.com' } });

  const reports = [
    {
      category: 'Acoso laboral',
      subject: 'Trato irrespetuoso reiterado en el area',
      description:
        'Durante las ultimas semanas se han presentado comentarios despectivos en las reuniones de equipo, que afectan el ambiente de trabajo y la participacion de varias personas.',
      isAnonymous: true,
      status: 'in_investigation' as const,
    },
    {
      category: 'Conflicto de interes',
      subject: 'Posible relacion comercial no declarada',
      description:
        'Se observa que un proveedor recientemente contratado tiene vinculo familiar con una persona que participa en el proceso de seleccion de proveedores.',
      isAnonymous: false,
      status: 'triaged' as const,
    },
    {
      category: 'Seguridad y salud',
      subject: 'Falta de senalizacion en el area de bodega',
      description:
        'El area de bodega no cuenta con la senalizacion adecuada para el transito de montacargas, lo que representa un riesgo para el personal.',
      isAnonymous: true,
      status: 'closed' as const,
    },
  ];

  for (const [index, definition] of reports.entries()) {
    const category = categories.find((c) => c.name === definition.category);
    const trackingCode = randomTrackingCode(random);
    const accessKey = `DEMO${String(index + 1).padStart(4, '0')}`;

    const report = await prisma.ethicsReport.create({
      data: {
        companyId,
        trackingCode,
        accessKeyHash: createHash('sha256').update(accessKey, 'utf8').digest('hex'),
        categoryId: category?.id ?? null,
        isAnonymous: definition.isAnonymous,
        reporterName: definition.isAnonymous ? null : encrypt('Persona identificada de prueba'),
        reporterEmail: definition.isAnonymous ? null : encrypt('reportante@correo.com'),
        relationship: pick(['employee', 'employee', 'supplier']),
        subject: encrypt(definition.subject) as string,
        description: encrypt(definition.description) as string,
        occurredAt: addDays(new Date(), -int(10, 60)),
        status: definition.status,
        severity: category?.defaultSeverity ?? 'medium',
        dueAt: addDays(new Date(), (category?.slaDays ?? 15) - 5),
        createdAt: addDays(new Date(), -int(5, 30)),
      },
    });

    await prisma.ethicsReportMessage.create({
      data: {
        companyId,
        reportId: report.id,
        authorKind: 'officer',
        authorUserId: officer?.id ?? null,
        body: encrypt(
          'Recibimos su reporte y ya inicio la revision. Le mantendremos informado por este mismo canal sin revelar su identidad.',
        ) as string,
      },
    });

    if (definition.status !== 'triaged') {
      const ethicsCase = await prisma.ethicsCase.create({
        data: {
          companyId,
          reportId: report.id,
          caseNumber: `ETH-${String(index + 1).padStart(5, '0')}`,
          status: definition.status,
          severity: category?.defaultSeverity ?? 'medium',
          leadUserId: officer?.id ?? null,
          investigationPlan: encrypt(
            'Entrevistar a las personas involucradas, revisar evidencia documental y emitir concepto del comite.',
          ),
          conclusions:
            definition.status === 'closed'
              ? encrypt('Se confirmo la situacion reportada y se implementaron medidas correctivas.')
              : null,
          measures:
            definition.status === 'closed'
              ? encrypt('Senalizacion instalada, capacitacion al personal y seguimiento mensual del area.')
              : null,
          openedAt: addDays(new Date(), -int(3, 25)),
          dueAt: addDays(new Date(), (category?.slaDays ?? 15) - 5),
          closedAt: definition.status === 'closed' ? addDays(new Date(), -2) : null,
        },
      });
      if (officer) {
        await prisma.ethicsCaseMember.create({
          data: { companyId, caseId: ethicsCase.id, userId: officer.id, role: 'lead' },
        });
      }
      await prisma.ethicsCaseAction.create({
        data: {
          companyId,
          caseId: ethicsCase.id,
          kind: 'entrevista',
          title: 'Entrevista con las partes involucradas',
          detail: encrypt('Se programaron entrevistas individuales con confidencialidad garantizada.'),
          status: definition.status === 'closed' ? 'completed' : 'in_progress',
          dueDate: addDays(new Date(), 5),
        },
      });
    }

    console.log(`  Denuncia demo ${trackingCode} / clave ${accessKey}`);
  }
}

async function createHelpdesk(companyId: string, employees: Array<{ id: string; status: string }>) {
  const categories = await prisma.ticketCategory.findMany({ where: { companyId } });
  const active = employees.filter((employee) => employee.status === 'active');
  const agents = await prisma.employee.findMany({
    where: { companyId, department: { name: 'Talento Humano' }, status: 'active' },
    select: { id: true, userId: true },
  });

  const subjects = [
    'Solicito certificado laboral con salario',
    'No puedo ingresar al portal del colaborador',
    'Consulta sobre saldo de vacaciones',
    'Actualizacion de cuenta bancaria',
    'Solicitud de carne corporativo',
    'Problema con el correo institucional',
    'Duda sobre el plan de beneficios',
    'Solicito cambio de horario',
    'Reporte de equipo danado',
    'Consulta sobre el proceso de evaluacion',
  ];

  for (let i = 0; i < 38; i += 1) {
    const requester = pick(active);
    const requesterUser = await prisma.employee.findFirst({
      where: { id: requester.id },
      select: { userId: true },
    });
    const category = pick(categories);
    const agent = pick(agents);
    const createdAt = addDays(new Date(), -int(0, 45));
    const roll = random();
    const status = roll < 0.35 ? 'resolved' : roll < 0.5 ? 'closed' : roll < 0.75 ? 'open' : 'new';
    const resolvedAt = ['resolved', 'closed'].includes(status)
      ? new Date(createdAt.getTime() + int(2, 60) * 3_600_000)
      : null;

    const ticket = await prisma.ticket.create({
      data: {
        companyId,
        number: i + 1,
        subject: pick(subjects),
        description:
          'Buenos dias, agradezco su ayuda con la siguiente solicitud. Quedo atento a su respuesta. Gracias.',
        categoryId: category.id,
        status,
        priority: pick(['low', 'normal', 'normal', 'high'] as const),
        requesterEmployeeId: requester.id,
        requesterUserId: requesterUser?.userId ?? null,
        assigneeEmployeeId: status === 'new' ? null : agent?.id ?? null,
        createdAt,
        firstResponseAt: status === 'new' ? null : new Date(createdAt.getTime() + int(1, 8) * 3_600_000),
        firstResponseDueAt: new Date(createdAt.getTime() + 4 * 3_600_000),
        resolutionDueAt: new Date(createdAt.getTime() + 48 * 3_600_000),
        resolvedAt,
        closedAt: status === 'closed' ? resolvedAt : null,
        slaBreached: resolvedAt ? resolvedAt.getTime() - createdAt.getTime() > 48 * 3_600_000 : false,
      },
    });

    await prisma.ticketMessage.create({
      data: {
        companyId,
        ticketId: ticket.id,
        authorUserId: requesterUser?.userId ?? null,
        authorName: 'Colaborador',
        body: ticket.description,
      },
    });

    if (status !== 'new') {
      await prisma.ticketMessage.create({
        data: {
          companyId,
          ticketId: ticket.id,
          authorUserId: agent?.userId ?? null,
          authorName: 'Talento Humano',
          body: 'Hola, recibimos su solicitud y ya estamos trabajando en ella. Le confirmamos en el transcurso del dia.',
        },
      });
    }

    if (['resolved', 'closed'].includes(status) && chance(0.6)) {
      await prisma.csatResponse.create({
        data: {
          companyId,
          ticketId: ticket.id,
          rating: int(3, 5),
          comment: chance(0.4) ? 'Respuesta rapida y clara, gracias.' : null,
        },
      });
    }
  }

  const macros = [
    { name: 'Certificado laboral en tramite', body: 'Su certificado laboral esta en tramite y lo recibira en el correo institucional en las proximas 24 horas habiles.' },
    { name: 'Restablecimiento de acceso', body: 'Hemos restablecido su acceso. Por favor ingrese con la contrasena temporal enviada a su correo y cambiela al iniciar.' },
    { name: 'Cierre de ticket', body: 'Damos por atendida su solicitud. Si necesita algo mas, puede responder este mismo ticket. Gracias.' },
  ];
  for (const macro of macros) {
    await prisma.macro.create({ data: { companyId, ...macro } });
  }

  const kbArticles = [
    'Como descargar mi certificado laboral',
    'Como solicitar vacaciones paso a paso',
    'Que hacer si olvide mi contrasena',
    'Como reportar una incapacidad',
  ];
  for (const title of kbArticles) {
    await prisma.kbArticle.create({
      data: {
        companyId,
        title,
        slug: slugify(title),
        summary: `Guia rapida: ${title.toLowerCase()}.`,
        blocks: postBlocks([
          `Siga estos pasos para ${title.toLowerCase()} desde el portal del colaborador.`,
          'Si el problema persiste, abra un ticket en la categoria correspondiente.',
        ]) as Prisma.InputJsonValue,
        status: 'published',
        viewCount: int(30, 300),
        helpfulCount: int(5, 60),
        tags: ['portal', 'ayuda'],
      },
    });
  }
}

async function createSst(
  companyId: string,
  employees: Array<{ id: string; status: string; hiredAt: Date }>,
  locations: Array<{ id: string }>,
  positions: Array<{ id: string; name: string }>,
) {
  const active = employees.filter((employee) => employee.status === 'active');

  for (const employee of active) {
    await prisma.medicalExam.create({
      data: {
        companyId,
        employeeId: employee.id,
        kind: 'entry',
        provider: 'IPS Ocupacional del Caribe',
        performedAt: addDays(employee.hiredAt, -3),
        result: 'fit',
        recommendations: encrypt('Sin restricciones. Uso de pausas activas.'),
      },
    });
    if (chance(0.35)) {
      const performedAt = addDays(new Date(), -int(30, 400));
      await prisma.medicalExam.create({
        data: {
          companyId,
          employeeId: employee.id,
          kind: 'periodic',
          provider: 'IPS Ocupacional del Caribe',
          performedAt,
          expiresAt: addMonths(performedAt, 12),
          result: chance(0.9) ? 'fit' : 'fit_with_restrictions',
          restrictions: chance(0.1) ? encrypt('Evitar levantamiento de cargas superiores a 15 kg.') : null,
        },
      });
    }
  }

  const accidents = [
    { kind: 'accident' as const, description: 'Caida al mismo nivel en el area de bodega por piso humedo.', bodyPart: 'Rodilla derecha', lostDays: 3, severity: 'medium' as const },
    { kind: 'accident' as const, description: 'Golpe con estanteria durante el almacenamiento de mercancia.', bodyPart: 'Mano izquierda', lostDays: 1, severity: 'low' as const },
    { kind: 'incident' as const, description: 'Cuasi accidente: montacargas transita sin senalizacion adecuada.', bodyPart: null, lostDays: 0, severity: 'medium' as const },
    { kind: 'occupational_disease' as const, description: 'Diagnostico de sindrome de tunel carpiano asociado a digitacion.', bodyPart: 'Muneca derecha', lostDays: 12, severity: 'high' as const },
  ];

  for (const [index, definition] of accidents.entries()) {
    const employee = pick(active);
    const occurredAt = addDays(new Date(), -int(20, 300));
    const accident = await prisma.workAccident.create({
      data: {
        companyId,
        employeeId: employee.id,
        code: `ATEL-${new Date().getUTCFullYear()}-${String(index + 1).padStart(4, '0')}`,
        kind: definition.kind,
        occurredAt,
        reportedAt: addDays(occurredAt, 1),
        locationId: pick(locations).id,
        place: pick(['Bodega principal', 'Area administrativa', 'Zona de cargue', 'Planta de produccion']),
        bodyPart: definition.bodyPart,
        severity: definition.severity,
        description: definition.description,
        furatNumber: `FURAT-${int(10000, 99999)}`,
        lostDays: definition.lostDays,
        status: chance(0.6) ? 'closed' : 'open',
      },
    });
    await prisma.accidentInvestigation.create({
      data: {
        companyId,
        accidentId: accident.id,
        rootCause: 'Condicion insegura no controlada en el area de trabajo.',
        immediateCauses: 'Falta de senalizacion y de inspeccion previa del area.',
        basicCauses: 'Procedimiento de inspeccion no documentado.',
        actionPlan:
          'Instalar senalizacion, capacitar al personal y programar inspecciones quincenales con lista de chequeo.',
        completedAt: addDays(occurredAt, 15),
      },
    });
  }

  const risks = [
    { hazard: 'Piso humedo en zona de cargue', hazardClass: 'Locativo', risk: 'Caida al mismo nivel', probability: 3, consequence: 3 },
    { hazard: 'Manipulacion manual de cargas', hazardClass: 'Biomecanico', risk: 'Lesion lumbar', probability: 4, consequence: 3 },
    { hazard: 'Uso prolongado de pantalla', hazardClass: 'Biomecanico', risk: 'Fatiga visual y musculoesqueletica', probability: 4, consequence: 2 },
    { hazard: 'Transito de montacargas', hazardClass: 'Mecanico', risk: 'Atrapamiento o golpe', probability: 2, consequence: 5 },
    { hazard: 'Ruido en planta', hazardClass: 'Fisico', risk: 'Hipoacusia', probability: 3, consequence: 4 },
  ];
  for (const risk of risks) {
    const score = risk.probability * risk.consequence;
    await prisma.riskMatrixEntry.create({
      data: {
        companyId,
        ...risk,
        positionId: pick(positions).id,
        locationId: pick(locations).id,
        exposedCount: int(5, 40),
        riskLevel: score >= 20 ? 'critico' : score >= 12 ? 'alto' : score >= 6 ? 'medio' : 'bajo',
        controls: 'Senalizacion, capacitacion, entrega de EPP e inspecciones periodicas.',
        residualLevel: 'medio',
        reviewedAt: addDays(new Date(), -int(10, 120)),
      },
    });
  }

  const operationsEmployees = await prisma.employee.findMany({
    where: { companyId, department: { name: 'Operaciones' }, status: 'active' },
    select: { id: true },
    take: 30,
  });
  for (const employee of operationsEmployees) {
    for (const ppeType of pickMany(['casco', 'guantes', 'botas', 'gafas', 'tapabocas'], int(2, 4))) {
      await prisma.ppeDelivery.create({
        data: {
          companyId,
          employeeId: employee.id,
          ppeType,
          quantity: 1,
          deliveredAt: addDays(new Date(), -int(10, 300)),
          replacesAt: addDays(new Date(), int(30, 200)),
          signedAt: new Date(),
        },
      });
    }
  }

  for (let i = 0; i < 4; i += 1) {
    await prisma.sstInspection.create({
      data: {
        companyId,
        title: pick([
          'Inspeccion de extintores y rutas de evacuacion',
          'Inspeccion de orden y aseo en bodega',
          'Inspeccion de puestos de trabajo administrativos',
          'Inspeccion de elementos de proteccion personal',
        ]),
        kind: 'general',
        locationId: pick(locations).id,
        scheduledAt: addDays(new Date(), int(-60, 30)),
        performedAt: chance(0.6) ? addDays(new Date(), -int(1, 55)) : null,
        findings: 'Se identifican oportunidades de mejora en senalizacion y almacenamiento.',
        actionPlan: 'Corregir hallazgos en un plazo maximo de 15 dias y verificar en la siguiente inspeccion.',
        status: chance(0.6) ? 'completed' : 'pending',
      },
    });
  }

  const committees = [
    { kind: 'copasst', name: 'COPASST 2026-2028' },
    { kind: 'convivencia', name: 'Comite de convivencia laboral 2026-2028' },
  ];
  for (const definition of committees) {
    const committee = await prisma.committee.create({
      data: {
        companyId,
        kind: definition.kind,
        name: definition.name,
        termStart: addDays(new Date(), -200),
        termEnd: addDays(new Date(), 530),
      },
    });
    for (const [index, employee] of pickMany(active, 4).entries()) {
      await prisma.committeeMember.create({
        data: {
          companyId,
          committeeId: committee.id,
          employeeId: employee.id,
          role: index === 0 ? 'presidente' : index === 1 ? 'secretario' : 'member',
          representation: index < 2 ? 'employer' : 'employee',
          isPrincipal: true,
        },
      });
    }
    for (let i = 0; i < 3; i += 1) {
      await prisma.committeeMinute.create({
        data: {
          companyId,
          committeeId: committee.id,
          number: `ACTA-${String(i + 1).padStart(3, '0')}`,
          meetingDate: addDays(new Date(), -30 * (i + 1)),
          agenda: 'Revision de indicadores, seguimiento a casos y plan de trabajo.',
          decisions: 'Se aprueba el plan de trabajo y se asignan responsables con fechas.',
          attendees: ['Presidente', 'Secretario', 'Representantes de los trabajadores'],
        },
      });
    }
  }
}

async function createSnapshots(
  companyId: string,
  employees: Array<{ id: string; hiredAt: Date; status: string; departmentId: string | null }>,
) {
  const rows = await prisma.employee.findMany({
    where: { companyId },
    select: { hiredAt: true, terminatedAt: true, departmentId: true, locationId: true },
  });

  const snapshots: Prisma.HrSnapshotCreateManyInput[] = [];
  for (let monthsAgo = 12; monthsAgo >= 0; monthsAgo -= 1) {
    const cursor = new Date();
    cursor.setUTCMonth(cursor.getUTCMonth() - monthsAgo);
    const day = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const active = rows.filter(
      (row) => row.hiredAt <= day && (!row.terminatedAt || row.terminatedAt > day),
    );

    snapshots.push({
      companyId,
      snapshotDate: day,
      metric: 'headcount',
      dimension: 'total',
      dimensionValue: 'all',
      value: new Prisma.Decimal(active.length),
    });

    const byDepartment = active.reduce<Record<string, number>>((acc, row) => {
      const key = row.departmentId ?? 'none';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    for (const [departmentId, value] of Object.entries(byDepartment)) {
      snapshots.push({
        companyId,
        snapshotDate: day,
        metric: 'headcount',
        dimension: 'department',
        dimensionValue: departmentId,
        value: new Prisma.Decimal(value),
      });
    }

    const hires = rows.filter(
      (row) =>
        row.hiredAt > new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)) &&
        row.hiredAt <= day,
    ).length;
    const exits = rows.filter(
      (row) =>
        row.terminatedAt &&
        row.terminatedAt > new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)) &&
        row.terminatedAt <= day,
    ).length;

    snapshots.push(
      {
        companyId,
        snapshotDate: day,
        metric: 'hires',
        dimension: 'total',
        dimensionValue: 'all',
        value: new Prisma.Decimal(hires),
      },
      {
        companyId,
        snapshotDate: day,
        metric: 'terminations',
        dimension: 'total',
        dimensionValue: 'all',
        value: new Prisma.Decimal(exits),
      },
    );
  }

  await prisma.hrSnapshot.createMany({ data: snapshots, skipDuplicates: true });

  // Expiry and risk alerts so the dashboard is not empty.
  const expiringDocuments = await prisma.employeeDocument.findMany({
    where: { companyId, expiresAt: { not: null, lte: addDays(new Date(), 30) } },
    include: { employee: { select: { fullName: true } }, documentType: { select: { name: true } } },
    take: 25,
  });
  for (const document of expiringDocuments) {
    await prisma.analyticsAlert.create({
      data: {
        companyId,
        kind: 'document_expiring',
        severity: 'medium',
        title: `Documento por vencer: ${document.documentType.name}`,
        detail: `${document.employee.fullName} - vence ${toDateKey(document.expiresAt!)}`,
        entityType: 'employee_document',
        entityId: document.id,
        dueDate: document.expiresAt,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error('La semilla demo fallo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
