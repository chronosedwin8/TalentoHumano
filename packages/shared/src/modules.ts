/**
 * Catalog of functional modules. The side menu, the routes and the
 * module x role matrix are all built from this catalog.
 */
export interface ModuleDefinition {
  key: string;
  /** i18n key for the label, resolved by the web app. */
  labelKey: string;
  icon: string;
  path: string;
  order: number;
  /** Modules that cannot be deactivated for a company. */
  core?: boolean;
  /** Visible in the employee self-service portal. */
  selfService?: boolean;
}

export const MODULES = {
  DASHBOARD: 'dashboard',
  PEOPLE: 'people',
  RECRUITING: 'recruiting',
  ONBOARDING: 'onboarding',
  LEAVES: 'leaves',
  TIME: 'time',
  LEARNING: 'learning',
  PERFORMANCE: 'performance',
  COMMUNICATION: 'communication',
  SURVEYS: 'surveys',
  ETHICS: 'ethics',
  DOCUMENTS: 'documents',
  HELPDESK: 'helpdesk',
  SST: 'sst',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

export const MODULE_CATALOG: ModuleDefinition[] = [
  { key: MODULES.DASHBOARD, labelKey: 'modules.dashboard', icon: 'LayoutDashboard', path: '/dashboard', order: 10, core: true, selfService: true },
  { key: MODULES.PEOPLE, labelKey: 'modules.people', icon: 'Users', path: '/people', order: 20, selfService: true },
  { key: MODULES.RECRUITING, labelKey: 'modules.recruiting', icon: 'UserSearch', path: '/recruiting', order: 30 },
  { key: MODULES.ONBOARDING, labelKey: 'modules.onboarding', icon: 'PackageCheck', path: '/onboarding', order: 40 },
  { key: MODULES.LEAVES, labelKey: 'modules.leaves', icon: 'CalendarDays', path: '/leaves', order: 50, selfService: true },
  { key: MODULES.TIME, labelKey: 'modules.time', icon: 'Clock', path: '/time', order: 60, selfService: true },
  { key: MODULES.LEARNING, labelKey: 'modules.learning', icon: 'GraduationCap', path: '/learning', order: 70, selfService: true },
  { key: MODULES.PERFORMANCE, labelKey: 'modules.performance', icon: 'Target', path: '/performance', order: 80, selfService: true },
  { key: MODULES.COMMUNICATION, labelKey: 'modules.communication', icon: 'Megaphone', path: '/communication', order: 90, selfService: true },
  { key: MODULES.SURVEYS, labelKey: 'modules.surveys', icon: 'ClipboardList', path: '/surveys', order: 100, selfService: true },
  { key: MODULES.ETHICS, labelKey: 'modules.ethics', icon: 'ShieldAlert', path: '/ethics', order: 110 },
  { key: MODULES.DOCUMENTS, labelKey: 'modules.documents', icon: 'FileText', path: '/documents', order: 120, selfService: true },
  { key: MODULES.HELPDESK, labelKey: 'modules.helpdesk', icon: 'LifeBuoy', path: '/helpdesk', order: 130, selfService: true },
  { key: MODULES.SST, labelKey: 'modules.sst', icon: 'HeartPulse', path: '/sst', order: 140 },
  { key: MODULES.ANALYTICS, labelKey: 'modules.analytics', icon: 'BarChart3', path: '/analytics', order: 150 },
  { key: MODULES.SETTINGS, labelKey: 'modules.settings', icon: 'Settings', path: '/settings', order: 900, core: true },
];

export const MODULE_KEYS = MODULE_CATALOG.map((m) => m.key);
