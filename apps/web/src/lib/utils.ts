import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
}

/** Informative only: the platform never calculates payroll. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = date.getTime() - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return 'hace un momento';
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Deterministic pastel colour for avatars and tags. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 62%, 52%)`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function firstDayOfMonthKey(): string {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  on_leave: 'En ausencia',
  suspended: 'Suspendido',
  pre_hire: 'Por ingresar',
  draft: 'Borrador',
  pending: 'Pendiente',
  pending_approval: 'Pendiente de aprobacion',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Anulado',
  taken: 'Disfrutado',
  published: 'Publicado',
  closed: 'Cerrado',
  paused: 'Pausado',
  fulfilled: 'Cubierta',
  in_progress: 'En curso',
  completed: 'Completado',
  overdue: 'Vencido',
  skipped: 'Omitido',
  assigned: 'Asignado',
  failed: 'No aprobado',
  expired: 'Vencido',
  hired: 'Contratado',
  withdrawn: 'Retirado',
  scheduled: 'Programado',
  done: 'Realizada',
  no_show: 'No asistio',
  sent: 'Enviada',
  accepted: 'Aceptada',
  new: 'Nuevo',
  open: 'Abierto',
  pending_requester: 'Esperando al solicitante',
  on_hold: 'En espera',
  resolved: 'Resuelto',
  received: 'Recibida',
  triaged: 'Clasificada',
  in_investigation: 'En investigacion',
  dismissed: 'Desestimada',
  present: 'Presente',
  absent: 'Ausente',
  late: 'Tarde',
  early_leave: 'Salida anticipada',
  leave: 'Ausencia',
  holiday: 'Festivo',
  rest: 'Descanso',
  remote: 'Remoto',
  self_assessment: 'Autoevaluacion',
  evaluation: 'Evaluacion',
  calibration: 'Calibracion',
  feedback_meeting: 'Reunion de feedback',
  archived: 'Archivado',
  low: 'Baja',
  normal: 'Normal',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
  critical: 'Critica',
  valid: 'Vigente',
  expiring: 'Por vencer',
  missing: 'Faltante',
  pending_review: 'En revision',
  onsite: 'Presencial',
  hybrid: 'Hibrido',
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
  undisclosed: 'Sin declarar',
  self: 'Autoevaluacion',
  manager: 'Jefe',
  peer: 'Par',
  direct_report: 'Reporte directo',
  internal_client: 'Cliente interno',
  submitted: 'Enviada',
  declined: 'Declinada',
  on_track: 'En curso',
  at_risk: 'En riesgo',
  off_track: 'Desviado',
  ready_now: 'Listo ahora',
  '1_2_years': '1 a 2 anos',
  '3_5_years': '3 a 5 anos',
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return STATUS_LABELS[status] ?? status;
}

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export function statusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'active':
    case 'approved':
    case 'completed':
    case 'published':
    case 'present':
    case 'valid':
    case 'hired':
    case 'accepted':
    case 'resolved':
    case 'done':
    case 'on_track':
    case 'ready_now':
      return 'success';
    case 'pending':
    case 'pending_approval':
    case 'in_progress':
    case 'expiring':
    case 'late':
    case 'at_risk':
    case 'scheduled':
    case 'triaged':
    case 'pending_requester':
      return 'warning';
    case 'rejected':
    case 'cancelled':
    case 'absent':
    case 'expired':
    case 'overdue':
    case 'failed':
    case 'off_track':
    case 'critical':
    case 'urgent':
      return 'danger';
    case 'draft':
    case 'inactive':
    case 'archived':
    case 'skipped':
    case 'rest':
      return 'muted';
    default:
      return 'info';
  }
}
