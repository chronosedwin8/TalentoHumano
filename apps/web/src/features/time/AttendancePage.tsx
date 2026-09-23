import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Download } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { BarChart } from '@/components/charts';
import { apiDownload, apiGet, apiList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  addDaysKey,
  formatDate,
  formatPercent,
  formatTime,
  statusLabel,
  statusTone,
  todayKey,
} from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  PageHeader,
  StatCard,
} from '@/components/ui/primitives';

interface AttendanceRow {
  id: string;
  date: string;
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    department: { name: string } | null;
  };
}

interface Summary {
  byStatus: Array<{ label: string; value: number }>;
  punctualityRate: number;
  absenteeismRate: number;
  workedHours: number;
  overtimeHours: number;
  days: number;
}

export function AttendancePage() {
  const can = useAuth((state) => state.can);
  const [from, setFrom] = React.useState(addDaysKey(-30));
  const [to, setTo] = React.useState(todayKey());
  const [status, setStatus] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [page, setPage] = React.useState(1);

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['time', 'attendance', { from, to, status, departmentId, page }],
    queryFn: () =>
      apiList<AttendanceRow>('/time/attendance', {
        from,
        to,
        status,
        departmentId,
        page,
        limit: 25,
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ['time', 'summary', { from, to }],
    queryFn: () => apiGet<Summary>('/time/attendance/summary', { from, to }),
    retry: false,
  });

  const columns: Array<Column<AttendanceRow>> = [
    {
      key: 'employee',
      header: 'Colaborador',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.employee.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.employee.department?.name ?? '—'}
          </p>
        </div>
      ),
    },
    { key: 'date', header: 'Fecha', render: (row) => formatDate(row.date) },
    {
      key: 'firstIn',
      header: 'Entrada',
      hideOnMobile: true,
      render: (row) => formatTime(row.firstIn),
    },
    {
      key: 'lastOut',
      header: 'Salida',
      hideOnMobile: true,
      render: (row) => formatTime(row.lastOut),
    },
    {
      key: 'workedMinutes',
      header: 'Trabajado',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums">
          {Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m
        </span>
      ),
    },
    {
      key: 'lateMinutes',
      header: 'Retardo',
      hideOnMobile: true,
      render: (row) =>
        row.lateMinutes > 0 ? (
          <span className="tabular-nums text-amber-600">{row.lateMinutes} min</span>
        ) : (
          '—'
        ),
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
        title="Asistencia"
        description="Registro diario calculado a partir de las marcaciones, ausencias y festivos."
        actions={
          <>
            {can('time.justification.approve') ? (
              <Button asChild variant="outline">
                <Link to="/time/justificaciones">
                  <ClipboardCheck className="h-4 w-4" />
                  Justificaciones
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() =>
                void apiDownload(
                  `/time/attendance/export?from=${from}&to=${to}&status=${status}&departmentId=${departmentId}`,
                  `asistencia-${from}-${to}.csv`,
                )
              }
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Puntualidad" value={formatPercent(summary?.punctualityRate ?? 0)} />
        <StatCard
          label="Ausentismo"
          value={formatPercent(summary?.absenteeismRate ?? 0)}
          tone="warning"
        />
        <StatCard label="Horas trabajadas" value={`${summary?.workedHours ?? 0} h`} />
        <StatCard
          label="Horas extra (informativas)"
          value={`${summary?.overtimeHours ?? 0} h`}
          hint="Solo conteo, sin valoracion"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Distribucion por estado</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={(summary?.byStatus ?? []).map((row) => ({
              label: statusLabel(row.label),
              value: row.value,
            }))}
            height={220}
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin registros de asistencia"
        toolbar={
          <>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="Hasta"
            />
            <NativeSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">Todos</option>
              <option value="present">Presente</option>
              <option value="late">Tarde</option>
              <option value="absent">Ausente</option>
              <option value="leave">Ausencia</option>
              <option value="holiday">Festivo</option>
            </NativeSelect>
            <NativeSelect
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
              className="w-48"
            >
              <option value="">Todas las areas</option>
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </div>
  );
}
