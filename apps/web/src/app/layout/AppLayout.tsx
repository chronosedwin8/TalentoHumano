import { MODULE_CATALOG } from '@talento/shared';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  HeartPulse,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  PackageCheck,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Target,
  UserCircle,
  UserSearch,
  Users,
  X,
} from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Button, Input } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import { NotificationsPanel } from './NotificationsPanel';

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(
    () => (localStorage.getItem('talento.theme') as 'light' | 'dark') ?? 'light',
  );
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('talento.theme', theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')) };
}

/**
 * Icons the navigation can name, resolved from an explicit map rather than a
 * wildcard import: `import * as Icons` would pull all 1500 lucide icons into
 * the entry chunk.
 */
const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  UserSearch,
  PackageCheck,
  CalendarDays,
  Clock,
  GraduationCap,
  Target,
  Megaphone,
  ClipboardList,
  ShieldAlert,
  FileText,
  LifeBuoy,
  HeartPulse,
  BarChart3,
  Settings,
  UserCircle,
  CheckSquare,
};

/** The side menu is built from the modules the user can actually see. */
function useVisibleModules() {
  const user = useAuth((state) => state.user);
  return React.useMemo(() => {
    const visible = new Set(user?.modules ?? []);
    return MODULE_CATALOG.filter((module) => visible.has(module.key)).sort(
      (a, b) => a.order - b.order,
    );
  }, [user?.modules]);
}

export function AppLayout() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout, switchCompany } = useAuth();
  const { locale, setLocale } = useI18n();
  const modules = useVisibleModules();

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  React.useEffect(() => setSidebarOpen(false), [location.pathname]);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => apiGet<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  const { data: approvals } = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: () => apiGet<{ count: number }>('/workflows/inbox/count'),
    refetchInterval: 120_000,
    retry: false,
  });

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r bg-background transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-4">
          {user?.company?.logoUrl ? (
            <img src={user.company.logoUrl} alt="" className="h-8 w-8 rounded-md object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              T
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.company?.name ?? 'TALENTO'}</p>
            <p className="truncate text-xs text-muted-foreground">{t('app.tagline')}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex h-[calc(100vh-4rem)] flex-col gap-1 overflow-y-auto p-3">
          <NavItem to="/portal" icon="UserCircle" label={t('nav.portal')} />
          <NavItem
            to="/approvals"
            icon="CheckSquare"
            label={t('nav.approvals')}
            badge={approvals?.count}
          />
          <div className="my-2 h-px bg-border" />
          {modules.map((module) => (
            <NavItem
              key={module.key}
              to={module.path}
              icon={module.icon}
              label={t(module.labelKey)}
            />
          ))}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1">
            {user && user.companies.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Building2 className="h-4 w-4" />
                    <span className="max-w-[140px] truncate">{user.company?.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{t('nav.company')}</DropdownMenuLabel>
                  {user.companies.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onSelect={() => void switchCompany(company.id)}
                      className={cn(company.id === user.company?.id && 'font-semibold')}
                    >
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationsOpen(true)}
              aria-label={t('nav.notifications')}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {unread?.count ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {unread.count > 9 ? '9+' : unread.count}
                </span>
              ) : null}
            </Button>

            <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('nav.theme')}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('nav.language')}>
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(['es', 'en', 'de'] as const).map((code) => (
                  <DropdownMenuItem
                    key={code}
                    onSelect={() => setLocale(code)}
                    className={cn(locale === code && 'font-semibold')}
                  >
                    {code === 'es' ? 'Espanol' : code === 'en' ? 'English' : 'Deutsch'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full focus-ring" aria-label={t('nav.profile')}>
                  <Avatar name={user?.fullName} src={user?.avatarUrl} size="md" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  {user?.roles.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {user.roles.slice(0, 3).map((role) => (
                        <Badge key={role} tone="muted" className="text-[10px]">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/portal/perfil')}>
                  <UserCircle className="h-4 w-4" />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void logout().then(() => navigate('/auth/ingresar'));
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {user?.impersonatedBy ? (
          <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
            Esta viendo la plataforma como {user.fullName}. Toda la actividad queda auditada.
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <NotificationsPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: string;
  label: string;
  badge?: number;
}) {
  const Icon = NAV_ICONS[icon] ?? Circle;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function GlobalSearch() {
  const t = useT();
  const navigate = useNavigate();
  const [term, setTerm] = React.useState('');

  return (
    <form
      className="relative hidden w-full max-w-md md:block"
      onSubmit={(event) => {
        event.preventDefault();
        if (term.trim()) navigate(`/buscar?q=${encodeURIComponent(term.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t('nav.search')}
        className="pl-9"
        aria-label={t('nav.search')}
      />
    </form>
  );
}
