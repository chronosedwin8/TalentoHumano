import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Info } from 'lucide-react';
import * as React from 'react';
import { apiDownload, apiList } from '@/lib/api';
import { firstDayOfMonthKey, formatDate, formatDateTime, todayKey } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';

interface ExportRow {
  id: string;
  name: string;
  periodFrom: string;
  periodTo: string;
  format: string;
  scopes: string[];
  rowCount: number;
  status: string;
  createdAt: string;
}

const SCOPES = [
  { key: 'leaves', label: 'Ausencias aprobadas' },
  { key: 'events', label: 'Novedades del colaborador' },
  { key: 'attendance', label: 'Asistencia (ausencias y horas extra informativas)' },
];

export function PayrollExportPage() {
  const [from, setFrom] = React.useState(firstDayOfMonthKey());
  const [to, setTo] = React.useState(todayKey());
  const [scopes, setScopes] = React.useState<string[]>(['leaves', 'events']);

  const { data, refetch } = useQuery({
    queryKey: ['leaves', 'payroll-exports'],
    queryFn: () => apiList<ExportRow>('/leaves/payroll-export', { limit: 20 }),
  });

  const runExport = useMutation({
    mutationFn: () =>
      apiDownload(`/leaves/payroll-export`, `novedades-${from}-${to}.csv`, {
        method: 'POST',
        body: { from, to, scopes, format: 'csv' },
      }),
    onSuccess: () => {
      toast.success('Exportacion generada', 'El archivo se descargo en su equipo.');
      void refetch();
    },
    onError: (error: Error) => toast.error('No fue posible exportar', error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exportacion a nomina externa"
        description="Unica interfaz con nomina y es solo de salida: TALENTO nunca calcula valores."
      />

      <Card className="border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-muted-foreground">
            El archivo contiene los dias y cantidades registrados en la plataforma. El calculo de
            valores, aportes y liquidaciones corresponde exclusivamente a su sistema de nomina.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generar exportacion</CardTitle>
          <CardDescription>Seleccione el periodo y el contenido a exportar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desde" required>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Hasta" required>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>

          <div className="space-y-2">
            {SCOPES.map((scope) => (
              <label key={scope.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope.key)}
                  onChange={(event) =>
                    setScopes((current) =>
                      event.target.checked
                        ? [...current, scope.key]
                        : current.filter((item) => item !== scope.key),
                    )
                  }
                  className="h-4 w-4 rounded border-input"
                />
                {scope.label}
              </label>
            ))}
          </div>

          <Button
            loading={runExport.isPending}
            disabled={scopes.length === 0}
            onClick={() => runExport.mutate()}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de exportaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aun no se ha generado ninguna exportacion.
            </p>
          ) : (
            data?.data.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.periodFrom)} — {formatDate(row.periodTo)} · {row.rowCount} filas
                    · {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.scopes.map((scope) => (
                    <Badge key={scope} tone="muted" className="text-[10px]">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
