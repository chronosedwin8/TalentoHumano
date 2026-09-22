import type { Scope } from './permissions.js';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

export interface EffectivePermission {
  code: string;
  scope: Scope;
}

export interface SessionCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  timezone: string;
  locale: string;
  modules: string[];
}

export interface SessionEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  positionName: string | null;
  departmentName: string | null;
  locationName: string | null;
  managerId: string | null;
  photoUrl: string | null;
  hiredAt: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isSuperadmin: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: EffectivePermission[];
  modules: string[];
  company: SessionCompany | null;
  companies: Array<{ id: string; name: string; slug: string }>;
  employee: SessionEmployee | null;
  impersonatedBy?: { id: string; email: string } | null;
}

/* ------------------------------------------------------------------ *
 * Block editor (LMS, wiki, posts, policies, document templates)
 * ------------------------------------------------------------------ */

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'quote'
  | 'callout'
  | 'table'
  | 'code'
  | 'divider'
  | 'columns'
  | 'accordion'
  | 'image'
  | 'gallery'
  | 'video'
  | 'audio'
  | 'file'
  | 'embed'
  | 'quickQuestion'
  | 'quiz'
  | 'flashcards'
  | 'tabs'
  | 'button'
  | 'timeline'
  | 'gate'
  | 'pulseSurvey'
  | 'pattern';

export interface Block {
  id: string;
  type: BlockType;
  /** Block specific payload; validated per type by the renderer. */
  data: Record<string, unknown>;
  children?: Block[];
  /** Blocks the learner must complete before the lesson is done. */
  required?: boolean;
}

export interface BlockDocument {
  version: number;
  blocks: Block[];
}

export const EMPTY_BLOCK_DOCUMENT: BlockDocument = { version: 1, blocks: [] };

/* ------------------------------------------------------------------ *
 * Dynamic forms (surveys, reviews, checklists, application forms)
 * ------------------------------------------------------------------ */

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'likert'
  | 'nps'
  | 'matrix'
  | 'ranking'
  | 'file'
  | 'rating'
  | 'section'
  | 'employee'
  | 'boolean';

export interface FormFieldOption {
  value: string;
  label: string;
  score?: number;
}

export interface FormFieldCondition {
  fieldKey: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'answered';
  value?: unknown;
}

export interface FormField {
  key: string;
  type: FormFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  /** Matrix rows, when type === 'matrix'. */
  rows?: FormFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Likert scale labels, low to high. */
  scaleLabels?: string[];
  /** Field is shown only when every condition matches. */
  conditions?: FormFieldCondition[];
  /** Analytics dimension this question feeds (climate index, eNPS, ...). */
  dimension?: string;
  weight?: number;
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */

export interface KpiValue {
  key: string;
  label: string;
  value: number | null;
  previousValue?: number | null;
  unit?: 'count' | 'percent' | 'days' | 'hours' | 'score';
  trend?: 'up' | 'down' | 'flat';
  /** True when a rising value is bad (turnover, absenteeism...). */
  inverse?: boolean;
}

export interface SeriesPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  locationId?: string;
  departmentId?: string;
  positionId?: string;
  contractType?: string;
  gender?: string;
  seniorityBand?: string;
}
