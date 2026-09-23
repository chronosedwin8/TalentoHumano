/* Pure helpers shared by the API and the web app. No IO, no framework. */

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${(firstName ?? '').charAt(0)}${(lastName ?? '').charAt(0)}`.toUpperCase() || '?';
}

export function fullName(parts: {
  firstName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
}): string {
  return [parts.firstName, parts.lastName, parts.secondLastName].filter(Boolean).join(' ').trim();
}

/* ----------------------------- dates ------------------------------- */

/** `YYYY-MM-DD` for a Date, in UTC. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses `YYYY-MM-DD` into a UTC Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let d = new Date(start.getTime()); d <= end; d = addDays(d, 1))
    out.push(new Date(d.getTime()));
  return out;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Counts days between two dates.
 * `businessDays` excludes Saturdays, Sundays and the supplied holiday keys.
 */
export function countDays(
  start: Date,
  end: Date,
  options: { businessDays?: boolean; holidays?: Set<string> } = {},
): number {
  const { businessDays = true, holidays = new Set<string>() } = options;
  let count = 0;
  for (const day of eachDay(start, end)) {
    if (businessDays && (isWeekend(day) || holidays.has(toDateKey(day)))) continue;
    count += 1;
  }
  return count;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Whole years of service between `hiredAt` and `at`. */
export function yearsOfService(hiredAt: Date, at: Date = new Date()): number {
  return daysBetween(hiredAt, at) / 365.25;
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function seniorityBand(hiredAt: Date, at: Date = new Date()): string {
  const years = yearsOfService(hiredAt, at);
  if (years < 0.5) return '0-6m';
  if (years < 1) return '6-12m';
  if (years < 3) return '1-3a';
  if (years < 5) return '3-5a';
  if (years < 10) return '5-10a';
  return '10a+';
}

export function ageBand(birthDate: Date, at: Date = new Date()): string {
  const age = yearsOfService(birthDate, at);
  if (age < 25) return '<25';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

/* --------------------- Colombian public holidays -------------------- */

/** Anonymous Gregorian computus. Returns Easter Sunday for `year` (UTC). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Moves a date to the following Monday (Ley Emiliani). */
function nextMonday(date: Date): Date {
  const day = date.getUTCDay();
  return day === 1 ? date : addDays(date, (8 - day) % 7);
}

export interface Holiday {
  date: string;
  name: string;
}

/** The 18 Colombian public holidays for a given year. */
export function colombianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed: Array<[number, number, string]> = [
    [1, 1, 'Ano Nuevo'],
    [5, 1, 'Dia del Trabajo'],
    [7, 20, 'Dia de la Independencia'],
    [8, 7, 'Batalla de Boyaca'],
    [12, 8, 'Inmaculada Concepcion'],
    [12, 25, 'Navidad'],
  ];
  const movable: Array<[number, number, string]> = [
    [1, 6, 'Reyes Magos'],
    [3, 19, 'Dia de San Jose'],
    [6, 29, 'San Pedro y San Pablo'],
    [8, 15, 'Asuncion de la Virgen'],
    [10, 12, 'Dia de la Raza'],
    [11, 1, 'Todos los Santos'],
    [11, 11, 'Independencia de Cartagena'],
  ];

  const out: Holiday[] = [];
  for (const [month, day, name] of fixed) {
    out.push({ date: toDateKey(new Date(Date.UTC(year, month - 1, day))), name });
  }
  for (const [month, day, name] of movable) {
    out.push({ date: toDateKey(nextMonday(new Date(Date.UTC(year, month - 1, day)))), name });
  }
  out.push({ date: toDateKey(addDays(easter, -3)), name: 'Jueves Santo' });
  out.push({ date: toDateKey(addDays(easter, -2)), name: 'Viernes Santo' });
  out.push({ date: toDateKey(nextMonday(addDays(easter, 43))), name: 'Ascension del Senor' });
  out.push({ date: toDateKey(nextMonday(addDays(easter, 64))), name: 'Corpus Christi' });
  out.push({ date: toDateKey(nextMonday(addDays(easter, 71))), name: 'Sagrado Corazon' });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------ misc -------------------------------- */

/** Haversine distance in meters; used for geofence validation. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function percent(part: number, total: number, decimals = 1): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(decimals));
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Replaces `{{path.to.value}}` placeholders in a template string. */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
        context,
      );
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Deterministic pastel colour from a string, for avatars and tags. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function formatDateEs(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Random tracking code for anonymous ethics reports: TAL-XXXX-XXXX. */
export function randomTrackingCode(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
  return `TAL-${part()}-${part()}`;
}

/* --------------------------- leave accrual -------------------------- */

export interface AccrualPeriod {
  /** First day the employee belongs to the company. */
  hiredAt: Date;
  /** Termination date, when the employee already left. */
  terminatedAt?: Date | null;
  /** Calendar year the balance is computed for. */
  year: number;
  /** Days granted per full year of service (15 business days in Colombia). */
  daysPerYear: number;
  /** "Today" for the calculation; accrual never runs into the future. */
  asOf?: Date;
}

/**
 * Vacation days accrued so far in `year`, prorated over the days the employee
 * actually belonged to the company inside that year.
 *
 * This is an entitlement count, never a monetary figure: the platform records
 * and exports leave data but performs no payroll or settlement calculation.
 */
export function accrueVacationDays(period: AccrualPeriod): number {
  const { hiredAt, terminatedAt, year, daysPerYear, asOf = new Date() } = period;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const start = hiredAt > yearStart ? hiredAt : yearStart;
  const end = terminatedAt && terminatedAt < yearEnd ? terminatedAt : yearEnd;
  const effectiveEnd = end > asOf ? asOf : end;

  // Hired after the window, or terminated before it starts.
  if (effectiveEnd < start) return 0;

  const daysWorked = Math.floor((effectiveEnd.getTime() - start.getTime()) / 86_400_000) + 1;
  return round((daysWorked / 365) * daysPerYear, 2);
}

/**
 * Days still available: what was accrued plus manual adjustments and carry
 * over, minus what was taken and what is awaiting approval.
 */
export function availableLeaveDays(balance: {
  accruedDays: number;
  adjustedDays?: number;
  carryOverDays?: number;
  takenDays?: number;
  pendingDays?: number;
}): number {
  return round(
    balance.accruedDays +
      (balance.adjustedDays ?? 0) +
      (balance.carryOverDays ?? 0) -
      (balance.takenDays ?? 0) -
      (balance.pendingDays ?? 0),
    2,
  );
}
