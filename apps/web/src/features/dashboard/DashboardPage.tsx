import type { AnalyticsFilters, KpiValue, SeriesPoint } from '@talento/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Cake,
  GraduationCap,
  LifeBuoy,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, DonutChart, LineChart, SeriesTable } from '@/components/charts';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { firstDayOfMonthKey, formatNumber, formatPercent, todayKey } from '@/lib/utils';

interface ExecutiveDashboard {
  period: { from: string; to: string };
  kpis: KpiValue[];
  byDepartment: SeriesPoint[];
  byLocation: SeriesPoint[];
  byContract: SeriesPoint[];
  demographics: {
    byGender: SeriesPoint[];
    byAge: SeriesPoint[];
    bySeniority: SeriesPoint[];
  };
  headcountSeries: SeriesPoint[];
}

interface AlertRow {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  severity: string;
  dueDate: string | null;
}

const KPI_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  headcount: Users,
  openJobs: BriefcaseBusiness,
  mandatoryTraining: GraduationCap,
  openTickets: LifeBuoy,
  absenteeism: CalendarClock,
};

export function DashboardPage() {
  const t = useT();
  const { user, can, hasModule } = useAuth();
  const [range, setRange] = React.useState<'month' | 'year'>('year');

  const filters: AnalyticsFilters = React.useMemo(
    () => ({
      from: range === 'month' ? firstDayOfMonthKey() : `${new Date().getUTCFullYear()}-01-01`,
      to: todayKey(),
    }),
    [range],
  );

  const canSeeExecutive = can('analytics.dashboard.read') || can('dashboard.executive.read');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'executive', filters],
    queryFn: () =>
      apiGet<ExecutiveDashboard>('/analytics/executive', filters as Record<string, unknown>),
    enabled: canSeeExecutive && hasModule('analytics'),
  });

  const { data: alerts } = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => apiGet<AlertRow[]>('/analytics/alerts', { limit: 6 }),
    enabled: can('analytics.alert.read'),
    retry: false,
  });

  const { data: celebrations } = useQuery({
    queryKey: ['dashboard', 'celebrations'],
    queryFn: () =>
      apiGet<{
        birthdays: Array<{ employeeId: string; fullName: string; day: number }>;
        anniversaries: Array<{ employeeId: string; fullName: string; day: number; years: number }>;
      }>('/communication/celebrations'),
    enabled: hasModule('communication'),
    retry: false,
  });

  if (!canSeeExecutive) {
    return <PersonalDashboard />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={`${t('dashboard.subtitle')} · ${user?.company?.name ?? ''}`}
        actions={
          <NativeSelect
            value={range}
            onChange={(event) => setRange(event.target.value as 'month' | 'year')}
            className="w-44"
            aria-label="Periodo"
          >
            <option value="month">Mes en curso</option>
            <option value="year">Ano en curso</option>
          </NativeSelect>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.kpis ?? []).map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolucion del headcount</CardTitle>
            <CardDescription>Colaboradores activos al cierre de cada mes</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={(data?.headcountSeries ?? []).map((point) => ({
                label: point.label,
                headcount: point.value,
              }))}
              series={[{ key: 'headcount', label: 'Colaboradores' }]}
              area
              height={260}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Vencimientos y riesgos detectados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alerts ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin alertas activas.</p>
            ) : (
              (alerts ?? []).map((alert) => (
                <div key={alert.id} className="flex gap-2 rounded-md border p-2.5 text-sm">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === 'high' ? 'text-destructive' : 'text-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{alert.title}</p>
                    {alert.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{alert.detail}</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas">Por area</TabsTrigger>
          <TabsTrigger value="sedes">Por sede</TabsTrigger>
          <TabsTrigger value="contratos">Por contrato</TabsTrigger>
          <TabsTrigger value="demografia">Demografia</TabsTrigger>
        </TabsList>

        <TabsContent value="areas">
          <Card>
            <CardHeader>
              <CardTitle>Colaboradores por area</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <BarChart data={data?.byDepartment ?? []} layout="horizontal" height={300} />
              <SeriesTable data={data?.byDepartment ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sedes">
          <Card>
            <CardHeader>
              <CardTitle>Colaboradores por sede</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={data?.byLocation ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de contrato vigentes</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={data?.byContract ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demografia">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Por genero</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={data?.demographics.byGender ?? []} height={200} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por rango de edad</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.demographics.byAge ?? []} height={200} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por antiguedad</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.demographics.bySeniority ?? []} height={200} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {celebrations &&
      (celebrations.birthdays.length > 0 || celebrations.anniversaries.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4" />
              Cumpleanos y aniversarios del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cumpleanos
              </p>
              <ul className="space-y-1 text-sm">
                {celebrations.birthdays.slice(0, 8).map((row) => (
                  <li key={row.employeeId} className="flex justify-between gap-2">
                    <span className="truncate">{row.fullName}</span>
                    <span className="text-muted-foreground">dia {row.day}</span>
                  </li>
                ))}
                {celebrations.birthdays.length === 0 ? (
                  <li className="text-muted-foreground">Ninguno este mes.</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aniversarios
              </p>
              <ul className="space-y-1 text-sm">
                {celebrations.anniversaries.slice(0, 8).map((row) => (
                  <li key={row.employeeId} className="flex justify-between gap-2">
                    <span className="truncate">{row.fullName}</span>
                    <span className="text-muted-foreground">{row.years} anos</span>
                  </li>
                ))}
                {celebrations.anniversaries.length === 0 ? (
                  <li className="text-muted-foreground">Ninguno este mes.</li>
                ) : null}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KpiValue }) {
  const Icon = KPI_ICONS[kpi.key];
  const value =
    kpi.unit === 'percent'
      ? formatPercent(kpi.value)
      : kpi.unit === 'days'
        ? `${formatNumber(kpi.value, 1)} d`
        : formatNumber(kpi.value);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {kpi.label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        {Icon ? (
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        ) : kpi.inverse ? (
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </Card>
  );
}

/** Fallback for users without analytics access: their own portal summary. */
function PersonalDashboard() {
  const user = useAuth((state) => state.user);
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.firstName ?? ''}`}
        description="Este es su espacio de trabajo en TALENTO."
      />
      <Card>
        <CardHeader>
          <CardTitle>Su portal</CardTitle>
          <CardDescription>
            Consulte sus solicitudes, formacion, evaluaciones y documentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/portal" className="text-sm font-medium text-primary hover:underline">
            Ir a mi portal
          </Link>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        {user?.modules.map((module) => (
          <Badge key={module} tone="muted">
            {module}
          </Badge>
        ))}
      </div>
    </div>
  );
}
