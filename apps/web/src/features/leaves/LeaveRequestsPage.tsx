import { leaveRequestSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Wallet, X } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { ApiRequestError, apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface LeaveRow {
  id: string;
  startDate: string;
  endDate: string;
  requestedDays: string;
  status: string;
  reason: string | null;
  leaveType: { id: string; name: string; code: string; color: string };
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    department: { name: string } | null;
  };
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  color: string;
  requiresAttachment: boolean;
  affectsBalance: boolean;
  minNoticeDays: number;
  maxDaysPerRequest: number | null;
}

export function LeaveRequestsPage() {
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'requests', { page, status, onlyMine }],
    queryFn: () =>
      apiList<LeaveRow>('/leaves/requests', {
        page,
        limit: 25,
        status,
        mine: onlyMine || undefined,
      }),
  });

  const { data: balance } = useQuery({
    queryKey: ['leaves', 'balance', user?.employee?.id],
    queryFn: () =>
      apiGet<{
        availableDays: number;
        accruedDays: number;
        takenDays: number;
        pendingDays: number;
      }>(`/leaves/balances/${user?.employee?.id}`),
    enabled: Boolean(user?.employee?.id),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/leaves/requests/${id}/cancel`, { reason: 'Anulada por el usuario' }),
    onSuccess: () => {
      toast.success('Solicitud anulada');
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (error: Error) => toast.error('No fue posible anular', error.message),
  });

  const columns: Array<Column<LeaveRow>> = [
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
    {
      key: 'leaveType',
      header: 'Tipo',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: row.leaveType.color }}
          />
          {row.leaveType.name}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Fechas',
      hideOnMobile: true,
      render: (row) => `${formatDate(row.startDate)} — ${formatDate(row.endDate)}`,
    },
    {
      key: 'requestedDays',
      header: 'Dias',
      render: (row) => <span className="tabular-nums">{Number(row.requestedDays)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        ['pending', 'approved'].includes(row.status) &&
        (row.employee.id === user?.employee?.id || can('leaves.request.approve')) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              cancel.mutate(row.id);
            }}
          >
            <X className="h-4 w-4" />
            Anular
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ausencias"
        description="Vacaciones, permisos, incapacidades y licencias con su flujo de aprobacion."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/leaves/calendario">
                <CalendarDays className="h-4 w-4" />
                Calendario
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/leaves/saldos">
                <Wallet className="h-4 w-4" />
                Saldos
              </Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva solicitud
            </Button>
          </>
        }
      />

      {balance ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Metric label="Dias disponibles" value={balance.availableDays} highlight />
            <Metric label="Causados" value={balance.accruedDays} />
            <Metric label="Disfrutados" value={balance.takenDays} />
            <Metric label="En tramite" value={balance.pendingDays} />
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin solicitudes"
        emptyDescription="Cree la primera solicitud de ausencia."
        toolbar={
          <>
            <NativeSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="taken">Disfrutadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="cancelled">Anuladas</option>
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(event) => {
                  setOnlyMine(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-input"
              />
              Solo las mias
            </label>
          </>
        }
      />

      <CreateLeaveDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function CreateLeaveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
    halfDayStart: false,
    halfDayEnd: false,
  });
  const [error, setError] = React.useState<string | null>(null);

  const { data: types } = useQuery({
    queryKey: ['leaves', 'types'],
    queryFn: () => apiGet<LeaveType[]>('/leaves/types'),
    enabled: open,
  });

  const selected = (types ?? []).find((type) => type.id === form.leaveTypeId);

  const create = useMutation({
    mutationFn: () =>
      apiPost('/leaves/requests', {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || null,
        halfDayStart: form.halfDayStart,
        halfDayEnd: form.halfDayEnd,
        fileIds: [],
      }),
    onSuccess: () => {
      toast.success('Solicitud enviada', 'Se notifico al aprobador correspondiente.');
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
      void queryClient.invalidateQueries({ queryKey: ['portal'] });
      onOpenChange(false);
      setError(null);
    },
    onError: (caught: Error) => {
      setError(
        caught instanceof ApiRequestError ? caught.message : 'No fue posible enviar la solicitud',
      );
    },
  });

  const submit = () => {
    setError(null);
    const parsed = leaveRequestSchema.safeParse({ ...form, fileIds: [] });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva solicitud de ausencia</DialogTitle>
          <DialogDescription>
            El sistema valida saldo, solapamientos y anticipacion minima antes de enviarla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Tipo de ausencia" required>
            <NativeSelect
              value={form.leaveTypeId}
              onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}
            >
              <option value="">Seleccione...</option>
              {(types ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {selected ? (
            <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              {selected.affectsBalance ? 'Descuenta del saldo de vacaciones. ' : ''}
              {selected.minNoticeDays > 0
                ? `Requiere ${selected.minNoticeDays} dias de anticipacion. `
                : ''}
              {selected.maxDaysPerRequest ? `Maximo ${selected.maxDaysPerRequest} dias. ` : ''}
              {selected.requiresAttachment ? 'Requiere adjuntar soporte.' : ''}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desde" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </Field>
            <Field label="Hasta" required>
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </Field>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.halfDayStart}
                onChange={(event) => setForm({ ...form, halfDayStart: event.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Medio dia al inicio
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.halfDayEnd}
                onChange={(event) => setForm({ ...form, halfDayEnd: event.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Medio dia al final
            </label>
          </div>

          <Field label="Motivo">
            <Textarea
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              rows={3}
              placeholder="Opcional"
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={create.isPending} disabled={!form.leaveTypeId} onClick={submit}>
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
