import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Play, Save, Table2, Trash2 } from 'lucide-react';
import * as React from 'react';
import { BarChart, DonutChart, LineChart } from '@/components/charts';
import { DataTable, type Column } from '@/components/DataTable';
import { apiDelete, apiDownload, apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
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
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface Dataset {
  key: string;
  label: string;
  columns: Array<{ key: string; label: string; type?: string }>;
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  dataset: string;
  columns: string[];
  filters: Record<string, unknown>;
  groupBy: string[];
  chartType: string;
  isShared: boolean;
  createdAt: string;
}

interface RunResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

const CHART_TYPES = [
  { value: 'table', label: 'Tabla' },
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Lineas' },
  { value: 'pie', label: 'Anillo' },
];

export function ReportBuilderPage() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();

  const [dataset, setDataset] = React.useState('');
  const [columns, setColumns] = React.useState<string[]>([]);
  const [groupBy, setGroupBy] = React.useState<string[]>([]);
  const [chartType, setChartType] = React.useState('table');
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SavedReport | null>(null);

  const { data: datasets } = useQuery({
    queryKey: ['analytics', 'datasets'],
    queryFn: () => apiGet<Dataset[]>('/analytics/datasets'),
  });

  const { data: saved } = useQuery({
    queryKey: ['analytics', 'reports'],
    queryFn: () => apiList<SavedReport>('/analytics/reports', { limit: 50 }),
    retry: false,
  });

  const current = (datasets ?? []).find((item) => item.key === dataset);

  React.useEffect(() => {
    // Pre-select the first dataset and its first columns once the catalog loads.
    if (!dataset && datasets?.length) {
      setDataset(datasets[0].key);
      setColumns(datasets[0].columns.slice(0, 5).map((column) => column.key));
    }
  }, [datasets, dataset]);

  const run = useMutation({
    mutationFn: () =>
      apiPost<RunResult>('/analytics/reports/run', { dataset, columns, filters: {}, groupBy }),
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast.error('No fue posible ejecutar el reporte', error.message),
  });

  const runSaved = useMutation({
    mutationFn: (report: SavedReport) => apiGet<RunResult>(`/analytics/reports/${report.id}/run`),
    onSuccess: (data, report) => {
      setDataset(report.dataset);
      setColumns(report.columns);
      setGroupBy(report.groupBy);
      setChartType(report.chartType);
      setResult(data);
    },
    onError: (error: Error) => toast.error('No fue posible ejecutar', error.message),
  });

  const remove = useMutation({
    mutationFn: (report: SavedReport) => apiDelete(`/analytics/reports/${report.id}`),
    onSuccess: () => {
      toast.success('Reporte eliminado');
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
      setDeleting(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  const toggleColumn = (key: string) =>
    setColumns((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const toggleGroup = (key: string) =>
    setGroupBy((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const tableColumns: Array<Column<Record<string, unknown>>> = (result?.columns ?? []).map(
    (key) => ({
      key,
      header: current?.columns.find((column) => column.key === key)?.label ?? key,
      render: (row) => {
        const value = row[key];
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'boolean') return value ? 'Si' : 'No';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
        return String(value);
      },
    }),
  );

  // A grouped run always returns [...groupBy, 'total'], which charts directly.
  const chartData = React.useMemo(() => {
    if (!result || !groupBy.length) return [];
    return result.rows.map((row) => ({
      label: groupBy.map((field) => String(row[field] ?? 'Sin dato')).join(' / '),
      value: Number(row.total ?? 0),
    }));
  }, [result, groupBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Constructor de reportes"
        description="Datasets seguros: solo devuelven los campos que su rol puede ver."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Definicion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Fuente de datos">
                <NativeSelect
                  value={dataset}
                  onChange={(event) => {
                    const next = (datasets ?? []).find((item) => item.key === event.target.value);
                    setDataset(event.target.value);
                    setColumns(next ? next.columns.slice(0, 5).map((column) => column.key) : []);
                    setGroupBy([]);
                    setResult(null);
                  }}
                >
                  {(datasets ?? []).map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <div>
                <p className="mb-1.5 text-sm font-medium">Columnas</p>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                  {(current?.columns ?? []).map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={columns.includes(column.key)}
                        onCheckedChange={() => toggleColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Agrupar por</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {(current?.columns ?? []).map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={groupBy.includes(column.key)}
                        onCheckedChange={() => toggleGroup(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
                {groupBy.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    El resultado devuelve el conteo por cada combinacion.
                  </p>
                ) : null}
              </div>

              <Field label="Visualizacion">
                <NativeSelect
                  value={chartType}
                  onChange={(event) => setChartType(event.target.value)}
                >
                  {CHART_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button
                  loading={run.isPending}
                  disabled={!dataset || (!columns.length && !groupBy.length)}
                  onClick={() => run.mutate()}
                >
                  <Play className="h-4 w-4" />
                  Ejecutar
                </Button>
                {can('analytics.report.create') ? (
                  <Button variant="outline" onClick={() => setSaving(true)} disabled={!dataset}>
                    <Save className="h-4 w-4" />
                    Guardar
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reportes guardados</CardTitle>
              <CardDescription>Los compartidos son visibles para todo el equipo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {(saved?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aun no ha guardado reportes.</p>
              ) : (
                saved?.data.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center gap-1 rounded-md p-1.5 hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => runSaved.mutate(report)}
                      className="min-w-0 flex-1 text-left text-sm"
                    >
                      <span className="block truncate font-medium">{report.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {report.dataset}
                        {report.isShared ? ' · compartido' : ''}
                      </span>
                    </button>
                    {can('analytics.export.execute') ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Exportar CSV"
                        onClick={() =>
                          void apiDownload(
                            `/analytics/reports/${report.id}/export`,
                            `${report.name}.csv`,
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {can('analytics.report.delete') ? (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(report)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!result ? (
            <EmptyState
              icon={Table2}
              title="Sin resultados"
              description="Elija una fuente, marque columnas y ejecute el reporte."
            />
          ) : (
            <>
              {chartType !== 'table' && chartData.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{current?.label ?? 'Resultado'}</CardTitle>
                    <CardDescription>Agrupado por {groupBy.join(' / ')}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} height={280} />
                    ) : chartType === 'line' ? (
                      <LineChart
                        data={chartData.map((point) => ({
                          label: point.label,
                          total: point.value,
                        }))}
                        series={[{ key: 'total', label: 'Total' }]}
                        height={280}
                      />
                    ) : (
                      <DonutChart data={chartData} height={280} />
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex items-center gap-2">
                <Badge tone="muted">{result.rows.length} filas</Badge>
              </div>

              <DataTable
                columns={tableColumns}
                rows={result.rows}
                rowKey={(row) => String(row.id ?? JSON.stringify(row))}
                total={result.rows.length}
                page={1}
                limit={result.rows.length || 1}
                emptyTitle="El reporte no devolvio filas"
              />
            </>
          )}
        </div>
      </div>

      {saving ? (
        <SaveDialog
          open
          onOpenChange={() => setSaving(false)}
          definition={{ dataset, columns, groupBy, chartType }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar reporte"
        description={`Se eliminara «${deleting?.name ?? ''}». Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SaveDialog({
  open,
  onOpenChange,
  definition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: { dataset: string; columns: string[]; groupBy: string[]; chartType: string };
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ name: '', description: '', isShared: false });

  const save = useMutation({
    mutationFn: () =>
      apiPost('/analytics/reports', {
        ...definition,
        name: form.name,
        description: form.description || null,
        filters: {},
        isShared: form.isShared,
      }),
    onSuccess: () => {
      toast.success('Reporte guardado');
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar reporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nombre" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Descripcion">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isShared}
              onCheckedChange={(checked) => setForm({ ...form, isShared: checked === true })}
            />
            Compartir con el equipo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={save.isPending}
            disabled={!form.name.trim()}
            onClick={() => save.mutate()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
