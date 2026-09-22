import { z } from 'zod';
import { PAGINATION } from './constants.js';

export const uuid = z.string().uuid('Identificador invalido');
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida (AAAA-MM-DD)');
export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());

export const passwordSchema = z
  .string()
  .min(10, 'La contrasena debe tener al menos 10 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayuscula')
  .regex(/[a-z]/, 'Debe incluir al menos una minuscula')
  .regex(/[0-9]/, 'Debe incluir al menos un numero')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un caracter especial');

export const emailSchema = z.string().trim().toLowerCase().email('Correo invalido');

/* ------------------------------ auth ------------------------------ */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingrese su contrasena'),
  companyId: uuid.optional(),
  twoFactorCode: z.string().regex(/^\d{6}$/).optional(),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const verifyTwoFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Codigo de 6 digitos'),
});

/* --------------------------- query params -------------------------- */

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  sort: z.string().optional(),
  search: z.string().trim().optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/* ------------------------- organization ---------------------------- */

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(2).default('CO'),
  timezone: z.string().default('America/Bogota'),
  phone: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().default(true),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(30).optional().nullable(),
  parentId: uuid.optional().nullable(),
  managerId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const positionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(30).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  level: z.string().trim().max(60).optional().nullable(),
  family: z.string().trim().max(120).optional().nullable(),
  departmentId: uuid.optional().nullable(),
  reportsToPositionId: uuid.optional().nullable(),
  salaryRangeMin: z.number().nonnegative().optional().nullable(),
  salaryRangeMax: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
});

/* ----------------------------- people ------------------------------ */

export const genderEnum = z.enum(['male', 'female', 'other', 'undisclosed']);
export const employeeStatusEnum = z.enum(['active', 'inactive', 'on_leave', 'pre_hire', 'suspended']);

export const employeeCreateSchema = z.object({
  employeeCode: z.string().trim().max(40).optional().nullable(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  secondLastName: z.string().trim().max(80).optional().nullable(),
  preferredName: z.string().trim().max(80).optional().nullable(),
  email: emailSchema,
  personalEmail: emailSchema.optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  mobile: z.string().trim().max(40).optional().nullable(),
  documentType: z.string().trim().max(20).default('CC'),
  documentNumber: z.string().trim().min(3).max(40),
  birthDate: isoDate.optional().nullable(),
  gender: genderEnum.optional().nullable(),
  nationality: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  hiredAt: isoDate,
  status: employeeStatusEnum.default('active'),
  positionId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  managerId: uuid.optional().nullable(),
  createUserAccount: z.boolean().default(true),
  customFields: z.record(z.unknown()).optional(),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ createUserAccount: true });

export const employmentContractSchema = z.object({
  employeeId: uuid,
  contractType: z.string().trim().min(2).max(60),
  startDate: isoDate,
  endDate: isoDate.optional().nullable(),
  positionId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  workModality: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  weeklyHours: z.number().min(1).max(80).optional().nullable(),
  probationEndsAt: isoDate.optional().nullable(),
  baseSalary: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isCurrent: z.boolean().default(true),
});

export const employeeMovementSchema = z.object({
  employeeId: uuid,
  movementType: z.string().trim().min(2).max(60),
  effectiveDate: isoDate,
  reason: z.string().trim().max(1000).optional().nullable(),
  newPositionId: uuid.optional().nullable(),
  newDepartmentId: uuid.optional().nullable(),
  newLocationId: uuid.optional().nullable(),
  newManagerId: uuid.optional().nullable(),
  newWorkModality: z.enum(['onsite', 'remote', 'hybrid']).optional().nullable(),
});

/* ----------------------------- leaves ------------------------------ */

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
  requiresApproval: z.boolean().default(true),
  requiresAttachment: z.boolean().default(false),
  affectsBalance: z.boolean().default(false),
  countsBusinessDays: z.boolean().default(true),
  maxDaysPerRequest: z.number().int().min(1).max(365).optional().nullable(),
  minNoticeDays: z.number().int().min(0).max(365).default(0),
  isPaid: z.boolean().default(true),
  requiresCoverage: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const leaveRequestSchema = z
  .object({
    employeeId: uuid.optional(),
    leaveTypeId: uuid,
    startDate: isoDate,
    endDate: isoDate,
    halfDayStart: z.boolean().default(false),
    halfDayEnd: z.boolean().default(false),
    reason: z.string().trim().max(1000).optional().nullable(),
    fileIds: z.array(uuid).default([]),
    coverageEmployeeId: uuid.optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La fecha final no puede ser anterior a la inicial',
    path: ['endDate'],
  });
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveDecisionSchema = z.object({
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const balanceAdjustmentSchema = z.object({
  employeeId: uuid,
  days: z.number().refine((n) => n !== 0, 'El ajuste no puede ser cero'),
  reason: z.string().trim().min(5).max(500),
  year: z.number().int().min(2000).max(2100).optional(),
});

/* ------------------------------ time ------------------------------- */

export const clockEntrySchema = z.object({
  type: z.enum(['in', 'out', 'break_start', 'break_end']),
  source: z.enum(['web', 'mobile', 'qr', 'device', 'manual', 'import']).default('web'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().nonnegative().optional().nullable(),
  locationId: uuid.optional().nullable(),
  photoFileId: uuid.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  deviceToken: z.string().max(200).optional().nullable(),
  occurredAt: isoDateTime.optional(),
});

export const workScheduleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  toleranceMinutes: z.number().int().min(0).max(120).default(10),
  isActive: z.boolean().default(true),
  rules: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        breakMinutes: z.number().int().min(0).max(240).default(60),
        isWorkingDay: z.boolean().default(true),
      }),
    )
    .min(1),
});

/* --------------------------- recruiting ---------------------------- */

export const requisitionSchema = z.object({
  title: z.string().trim().min(3).max(160),
  positionId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  reason: z.string().trim().min(2).max(60),
  openings: z.number().int().min(1).max(200).default(1),
  neededBy: isoDate.optional().nullable(),
  justification: z.string().trim().max(2000).optional().nullable(),
  contractType: z.string().trim().max(60).optional().nullable(),
  salaryRangeMin: z.number().nonnegative().optional().nullable(),
  salaryRangeMax: z.number().nonnegative().optional().nullable(),
  replacingEmployeeId: uuid.optional().nullable(),
});

export const jobPostingSchema = z.object({
  requisitionId: uuid.optional().nullable(),
  title: z.string().trim().min(3).max(160),
  positionId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  workModality: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  contractType: z.string().trim().max(60).optional().nullable(),
  openings: z.number().int().min(1).max(200).default(1),
  description: z.string().trim().max(20000),
  requirements: z.string().trim().max(20000).optional().nullable(),
  benefits: z.string().trim().max(8000).optional().nullable(),
  salaryRangeMin: z.number().nonnegative().optional().nullable(),
  salaryRangeMax: z.number().nonnegative().optional().nullable(),
  salaryVisible: z.boolean().default(false),
  closesAt: isoDate.optional().nullable(),
  recruiterId: uuid.optional().nullable(),
  hiringManagerId: uuid.optional().nullable(),
  isInternal: z.boolean().default(false),
  competencyIds: z.array(uuid).default([]),
});

export const publicApplicationSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: z.string().trim().min(6).max(40),
  documentNumber: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  linkedinUrl: z.string().url().max(240).optional().nullable().or(z.literal('')),
  source: z.string().trim().max(60).default('portal'),
  referredByEmployeeId: uuid.optional().nullable(),
  coverLetter: z.string().trim().max(8000).optional().nullable(),
  resumeFileId: uuid.optional().nullable(),
  answers: z.record(z.unknown()).optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debe aceptar la politica de tratamiento de datos' }),
  }),
});
export type PublicApplicationInput = z.infer<typeof publicApplicationSchema>;

export const moveApplicationSchema = z.object({
  stageId: uuid,
  note: z.string().trim().max(1000).optional().nullable(),
  notifyCandidate: z.boolean().default(false),
});

export const rejectApplicationSchema = z.object({
  reasonId: uuid.optional().nullable(),
  reason: z.string().trim().min(3).max(200),
  keepInTalentPool: z.boolean().default(true),
  notifyCandidate: z.boolean().default(true),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const hireCandidateSchema = z.object({
  hiredAt: isoDate,
  positionId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  managerId: uuid.optional().nullable(),
  contractType: z.string().trim().max(60).default('indefinido'),
  contractEndDate: isoDate.optional().nullable(),
  workModality: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  baseSalary: z.number().nonnegative().optional().nullable(),
  onboardingTemplateId: uuid.optional().nullable(),
  createUserAccount: z.boolean().default(true),
});

export const scorecardSchema = z.object({
  interviewId: uuid,
  overallRating: z.number().int().min(1).max(5),
  recommendation: z.enum(['strong_yes', 'yes', 'neutral', 'no', 'strong_no']),
  strengths: z.string().trim().max(4000).optional().nullable(),
  concerns: z.string().trim().max(4000).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  ratings: z
    .array(z.object({ competencyId: uuid, rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional().nullable() }))
    .default([]),
});

/* ---------------------------- learning ----------------------------- */

export const blockDocumentSchema = z.object({
  version: z.number().int().min(1).default(1),
  blocks: z.array(z.any()).default([]),
});

export const courseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  kind: z.enum(['internal', 'external']).default('internal'),
  provider: z.string().trim().max(160).optional().nullable(),
  estimatedMinutes: z.number().int().min(0).max(100000).default(0),
  isMandatory: z.boolean().default(false),
  recertificationMonths: z.number().int().min(0).max(120).optional().nullable(),
  passingScore: z.number().int().min(0).max(100).default(70),
  coverFileId: uuid.optional().nullable(),
  informativeCost: z.number().nonnegative().optional().nullable(),
  tags: z.array(z.string().max(40)).default([]),
});

export const lessonSchema = z.object({
  moduleId: uuid,
  title: z.string().trim().min(2).max(200),
  kind: z.enum(['content', 'quiz', 'assignment', 'live_session', 'scorm']).default('content'),
  estimatedMinutes: z.number().int().min(0).max(10000).default(5),
  isRequired: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export const lessonContentSchema = z.object({
  blocks: blockDocumentSchema,
  publish: z.boolean().default(false),
  changeNote: z.string().trim().max(500).optional().nullable(),
});

/* --------------------------- performance --------------------------- */

export const objectiveSchema = z.object({
  cycleId: uuid,
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(4000).optional().nullable(),
  level: z.enum(['company', 'department', 'team', 'individual']).default('individual'),
  ownerEmployeeId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  parentId: uuid.optional().nullable(),
  weight: z.number().min(0).max(100).default(100),
  startDate: isoDate.optional().nullable(),
  dueDate: isoDate.optional().nullable(),
  keyResults: z
    .array(
      z.object({
        id: uuid.optional(),
        title: z.string().trim().min(2).max(240),
        metric: z.string().trim().max(80).optional().nullable(),
        startValue: z.number().default(0),
        targetValue: z.number(),
        currentValue: z.number().default(0),
        weight: z.number().min(0).max(100).default(100),
      }),
    )
    .default([]),
});

export const checkinSchema = z.object({
  keyResultId: uuid,
  value: z.number(),
  confidence: z.enum(['on_track', 'at_risk', 'off_track']).default('on_track'),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const feedbackSchema = z.object({
  toEmployeeId: uuid,
  kind: z.enum(['praise', 'suggestion', 'request', 'general']).default('general'),
  visibility: z.enum(['public', 'private', 'manager_only']).default('private'),
  message: z.string().trim().min(3).max(4000),
  competencyId: uuid.optional().nullable(),
});

/* ---------------------------- surveys ------------------------------ */

export const surveyResponseSchema = z.object({
  invitationToken: z.string().min(8).optional(),
  answers: z.record(z.unknown()),
  completed: z.boolean().default(true),
});

/* ----------------------------- ethics ------------------------------ */

export const ethicsReportSchema = z.object({
  categoryId: uuid.optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  isAnonymous: z.boolean().default(true),
  reporterName: z.string().trim().max(160).optional().nullable(),
  reporterEmail: emailSchema.optional().nullable(),
  reporterPhone: z.string().trim().max(40).optional().nullable(),
  relationship: z.enum(['employee', 'client', 'supplier', 'contractor', 'other']).default('employee'),
  subject: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(20000),
  occurredAt: isoDate.optional().nullable(),
  involvedPersons: z.string().trim().max(2000).optional().nullable(),
  fileIds: z.array(uuid).default([]),
  consentAccepted: z.literal(true),
});

export const ethicsFollowUpSchema = z.object({
  trackingCode: z.string().trim().min(8).max(40),
  accessKey: z.string().trim().min(6).max(64),
});

export const ethicsMessageSchema = ethicsFollowUpSchema.extend({
  message: z.string().trim().min(2).max(8000),
});

/* ---------------------------- helpdesk ----------------------------- */

export const ticketSchema = z.object({
  categoryId: uuid.optional().nullable(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(20000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  fileIds: z.array(uuid).default([]),
  requesterEmployeeId: uuid.optional().nullable(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  isInternal: z.boolean().default(false),
  fileIds: z.array(uuid).default([]),
});

/* --------------------------- workflows ----------------------------- */

export const workflowDecisionSchema = z.object({
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const workflowDelegateSchema = z.object({
  toUserId: uuid,
  comment: z.string().trim().max(2000).optional().nullable(),
});

/* ----------------------------- files ------------------------------- */

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  mimeType: z.string().trim().min(3).max(160),
  size: z.number().int().positive(),
  visibility: z.enum(['private', 'company', 'public']).default('private'),
  entityType: z.string().trim().max(60).optional().nullable(),
  entityId: uuid.optional().nullable(),
});
