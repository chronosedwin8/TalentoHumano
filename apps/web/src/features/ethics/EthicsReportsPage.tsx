import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { DonutChart } from '@/components/charts';
import { apiGet, apiList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPercent, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  PageHeader,
  StatCard,
} from '@/components/ui/primitives';

interface ReportRow {
  id: string;
  trackingCode: string;
  subject: string;
  category: string | null;
  status: string;
  severity: string;
  isAnonymous: boolean;
  createdAt: string;
  dueAt: string | null;
  case: { id: string; caseNumber: string } | null;
}

interface Statistics {
  total: number;
  anonymousRate: number;
  averageClosureDays: number;
  byCategory: Array<{ label: string; value: number }>;
  byStatus: Array<{ label: string; value: number }>;
  bySeverity: Array<{ label: string; value: number }>;
}

export function EthicsReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ethics', 'reports', { page, status }],
    queryFn: () => apiList<ReportRow>('/ethics/reports', { page, limit: 25, status }),
  });

  const { data: statistics } = useQuery({
    queryKey: ['ethics', 'statistics'],
    queryFn: () => apiGet<Statistics>('/ethics/statistics'),
    retry: false,
  });

  const columns: Array<Column<ReportRow>> = [
    {
      key: 'trackingCode',
      header: 'Codigo',
      render: (row) => <span className="font-mono text-xs">{row.trackingCode}</span>,
    },
    {
      key: 'subject',
      header: 'Asunto',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.category ?? 'Sin categoria'}
          </p>
        </div>
      ),
    },
    {
      key: 'isAnonymous',
      header: 'Origen',
      hideOnMobile: true,
      render: (row) => (
        <Badge tone={row.isAnonymous ? 'info' : 'muted'}>
          {row.isAnonymous ? 'Anonima' : 'Identificada'}
        </Badge>
      ),
    },
    {
      key: 'severity',
      header: 'Gravedad',
      hideOnMobile: true,
      render: (row) => <Badge tone={statusTone(row.severity)}>{statusLabel(row.severity)}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Recibida',
      hideOnMobile: true,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'dueAt',
      header: 'Plazo',
      hideOnMobile: true,
      render: (row) => {
        if (!row.dueAt) return '—';
        const overdue = new Date(row.dueAt) < new Date() && row.status !== 'closed';
        return (
          <span className={overdue ? 'font-medium text-destructive' : ''}>
            {formatDate(row.dueAt)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canal de denuncias"
        description="Acceso restringido al oficial de etica. Cada consulta queda registrada."
      />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            El contenido esta cifrado y las denuncias anonimas no guardan IP ni dispositivo. Si
            usted esta implicado en un caso, el sistema se lo oculta automaticamente.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Denuncias recibidas" value={statistics?.total ?? 0} />
        <StatCard label="Anonimas" value={formatPercent(statistics?.anonymousRate ?? 0)} />
        <StatCard label="Dias promedio de cierre" value={statistics?.averageClosureDays ?? 0} />
        <StatCard
          label="Portal publico"
          value={`/ethics/${user?.company?.slug ?? ''}`}
          hint="Enlace sin login"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por categoria</CardTitle>
            <CardDescription>Datos agregados, nunca el detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={statistics?.byCategory ?? []} height={220} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={(statistics?.byStatus ?? []).map((row) => ({
                label: statusLabel(row.label),
                value: row.value,
              }))}
              height={220}
            />
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/ethics/reports/${row.id}`)}
        emptyTitle="Sin denuncias registradas"
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="">Todos los estados</option>
            <option value="received">Recibidas</option>
            <option value="triaged">Clasificadas</option>
            <option value="in_investigation">En investigacion</option>
            <option value="closed">Cerradas</option>
            <option value="dismissed">Desestimadas</option>
          </NativeSelect>
        }
      />
    </div>
  );
}
