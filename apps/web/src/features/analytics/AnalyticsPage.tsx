import type { KpiValue, SeriesPoint } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellRing, Check, RefreshCw, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, DonutChart, LineChart, SeriesTable } from '@/components/charts';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  formatDate,
  formatNumber,
  formatPercent,
  statusLabel,
  statusTone,
  todayKey,
} from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

interface Executive {
  period: { from: string; to: string };
  kpis: KpiValue[];
  byDepartment: SeriesPoint[];
  byLocation: SeriesPoint[];
  byContract: SeriesPoint[];
  demographics: { byGender: SeriesPoint[]; byAge: SeriesPoint[]; bySeniority: SeriesPoint[] };
  headcountSeries: SeriesPoint[];
}

interface Alert {
  id: string;
  kind: string;
  severity: string;
  title: string;
  detail: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface TurnoverRisk {
  employeeId: string;
  fullName: string;
  department: string | null;
  score: number;
  reasons: string[];
}

export function AnalyticsPage() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [from, setFrom] = React.useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 11);
    return `${date.toISOString().slice(0, 7)}-01`;
  });
  const [to, setTo] = React.useState(todayKey());

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'executive', from, to],
    queryFn: () => apiGet<Executive>('/analytics/executive', { from, to }),
    retry: false,
  });

  const { data: alerts } = useQuery({
    queryKey: ['analytics', 'alerts'],
    queryFn: () => apiList<Alert>('/analytics/alerts', { limit: 50 }),
    enabled: can('analytics.alert.read'),
    retry: false,
  });

  const { data: risks } = useQuery({
    queryKey: ['analytics', 'turnover-risk'],
    queryFn: () => apiGet<TurnoverRisk[]>('/analytics/turnover-risk'),
    enabled: can('analytics.alert.read'),
    retry: false,
  });

  const refreshAlerts = useMutation({
    mutationFn: () =>
      apiPost<{ expiryAlerts: number; turnoverRisks: number }>('/analytics/alerts/run', {}),
    onSuccess: (result) => {
      toast.success(
        'Alertas recalculadas',
        `${result.expiryAlerts} vencimientos, ${result.turnoverRisks} riesgos.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error: Error) => toast.error('No fue posible recalcular', error.message),
  });

  const resolveAlert = useMutation({
    mutationFn: (id: string) => apiPost(`/analytics/alerts/${id}/resolve`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['analytics', 'alerts'] }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const kpi = (key: string) => data?.kpis.find((item) => item.key === key);
  const tone = (kpiValue: KpiValue | undefined, warn: number, bad: number) => {
    if (!kpiValue?.inverse || kpiValue.value === null) return undefined;
    const value = kpiValue.value;
    return value >= bad
      ? ('danger' as const)
      : value >= warn
        ? ('warning' as const)
        : ('success' as const);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analitica de talento humano"
        description="Indicadores ejecutivos, demografia y alertas tempranas."
        actions={
          <>
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-40"
              aria-label="Hasta"
            />
            {can('analytics.report.read') ? (
              <Button asChild variant="outline">
                <Link to="/analytics/reportes">Constructor de reportes</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Colaboradores activos"
          value={formatNumber(kpi('headcount')?.value ?? 0)}
        />
        <StatCard label="Ingresos del periodo" value={formatNumber(kpi('hires')?.value ?? 0)} />
        <StatCard
          label="Rotacion"
          value={formatPercent(kpi('turnover')?.value ?? 0)}
          hint={`Voluntaria ${formatPercent(kpi('voluntaryTurnover')?.value ?? 0)}`}
          tone={tone(kpi('turnover'), 10, 20)}
        />
        <StatCard
          label="Ausentismo"
          value={formatPercent(kpi('absenteeism')?.value ?? 0)}
          tone={tone(kpi('absenteeism'), 4, 8)}
        />
        <StatCard label="Vacantes abiertas" value={formatNumber(kpi('openJobs')?.value ?? 0)} />
        <StatCard
          label="Formacion obligatoria al dia"
          value={formatPercent(kpi('mandatoryTraining')?.value ?? 0)}
          tone={
            (kpi('mandatoryTraining')?.value ?? 0) >= 90
              ? 'success'
              : (kpi('mandatoryTraining')?.value ?? 0) >= 70
                ? 'warning'
                : 'danger'
          }
        />
        <StatCard
          label="Tickets abiertos"
          value={formatNumber(kpi('openTickets')?.value ?? 0)}
          tone={tone(kpi('openTickets'), 20, 50)}
        />
        <StatCard
          label="Documentos por vencer"
          value={formatNumber(kpi('expiringDocuments')?.value ?? 0)}
          tone={tone(kpi('expiringDocuments'), 10, 30)}
        />
      </div>

      <Tabs defaultValue="plantilla">
        <TabsList className="flex-wrap">
          <TabsTrigger value="plantilla">Plantilla</TabsTrigger>
          <TabsTrigger value="demografia">Demografia</TabsTrigger>
          {can('analytics.alert.read') ? <TabsTrigger value="alertas">Alertas</TabsTrigger> : null}
          {can('analytics.alert.read') ? (
            <TabsTrigger value="riesgo">Riesgo de rotacion</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="plantilla">
          <div className="grid gap-4 pt-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Evolucion de la plantilla</CardTitle>
                <CardDescription>Colaboradores activos al cierre de cada mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={(data?.headcountSeries ?? []).map((point) => ({
                    label: point.label,
                    headcount: point.value,
                  }))}
                  series={[{ key: 'headcount', label: 'Colaboradores' }]}
                  height={260}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Por area</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.byDepartment ?? []} height={260} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Por sede</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.byLocation ?? []} height={260} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Por tipo de contrato</CardTitle>
                <CardDescription>Distribucion vigente de vinculaciones.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DonutChart
                  data={(data?.byContract ?? []).map((row) => ({
                    label: statusLabel(row.label),
                    value: row.value,
                  }))}
                  height={240}
                />
                <SeriesTable
                  data={(data?.byContract ?? []).map((row) => ({
                    label: statusLabel(row.label),
                    value: row.value,
                  }))}
                  unit="colaboradores"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demografia">
          <div className="grid gap-4 pt-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Por genero</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={(data?.demographics.byGender ?? []).map((row) => ({
                    label: statusLabel(row.label),
                    value: row.value,
                  }))}
                  height={220}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Por rango de edad</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.demographics.byAge ?? []} height={220} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Por antiguedad</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data?.demographics.bySeniority ?? []} height={220} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alertas">
          <div className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                loading={refreshAlerts.isPending}
                onClick={() => refreshAlerts.mutate()}
              >
                <RefreshCw className="h-4 w-4" />
                Recalcular alertas
              </Button>
            </div>
            {(alerts?.data ?? []).length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="Sin alertas activas"
                description="Todo esta al dia."
              />
            ) : (
              alerts?.data.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <AlertTriangle
                      className={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'h-4 w-4 shrink-0 text-destructive'
                          : 'h-4 w-4 shrink-0 text-amber-500'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{alert.title}</p>
                      {alert.detail ? (
                        <p className="text-sm text-muted-foreground">{alert.detail}</p>
                      ) : null}
                    </div>
                    <Badge tone={statusTone(alert.severity)}>{statusLabel(alert.severity)}</Badge>
                    {alert.dueDate ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(alert.dueDate)}
                      </span>
                    ) : null}
                    {can('analytics.alert.manage') ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resolveAlert.mutate(alert.id)}
                      >
                        <Check className="h-4 w-4" />
                        Resolver
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="riesgo">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Riesgo de rotacion</CardTitle>
              <CardDescription>
                Heuristica sobre antiguedad, desempeno, ausentismo y movimientos recientes. Es una
                senal para conversar, nunca una decision automatica sobre la persona.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(risks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin senales de riesgo identificadas.
                </p>
              ) : (
                risks?.slice(0, 25).map((risk) => (
                  <div
                    key={risk.employeeId}
                    className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
                  >
                    <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{risk.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {risk.department ?? 'Sin area'} · {risk.reasons.join(', ')}
                      </p>
                    </div>
                    <Badge
                      tone={risk.score >= 70 ? 'danger' : risk.score >= 40 ? 'warning' : 'muted'}
                    >
                      {formatNumber(risk.score)} / 100
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
