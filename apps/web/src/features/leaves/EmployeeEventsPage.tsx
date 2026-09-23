import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
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

interface EventRow {
  id: string;
  eventType: string;
  title: string;
  startDate: string;
  endDate: string | null;
  quantity: string | null;
  unit: string | null;
  status: string;
  employee: { id: string; fullName: string; employeeCode: string };
}

export function EmployeeEventsPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [eventType, setEventType] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'events', { page, eventType }],
    queryFn: () => apiList<EventRow>('/leaves/events', { page, limit: 25, eventType }),
  });

  const columns: Array<Column<EventRow>> = [
    {
      key: 'employee',
      header: 'Colaborador',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.employee.fullName}</p>
          <p className="text-xs text-muted-foreground">{row.employee.employeeCode}</p>
        </div>
      ),
    },
    { key: 'title', header: 'Novedad' },
    {
      key: 'eventType',
      header: 'Tipo',
      hideOnMobile: true,
      render: (row) => <Badge tone="muted">{row.eventType.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'startDate',
      header: 'Fecha',
      hideOnMobile: true,
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      hideOnMobile: true,
      render: (row) =>
        row.quantity ? (
          <span className="tabular-nums">
            {Number(row.quantity)} {row.unit ?? ''}
          </span>
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
        title="Novedades del colaborador"
        description="Eventos que Talento Humano registra y sigue. Sin efecto contable ni de nomina."
        actions={
          can('leaves.event.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar novedad
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin novedades registradas"
        toolbar={
          <NativeSelect
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              setPage(1);
            }}
            className="w-56"
          >
            <option value="">Todos los tipos</option>
            <option value="horas_extra">Horas extra (informativo)</option>
            <option value="incapacidad_prolongada">Incapacidad prolongada</option>
            <option value="prestamo_equipo">Prestamo de equipo</option>
            <option value="sancion">Sancion</option>
            <option value="felicitacion">Felicitacion</option>
            <option value="comision">Comision</option>
            <option value="cambio_datos">Cambio de datos</option>
          </NativeSelect>
        }
      />

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    employeeId: '',
    eventType: 'horas_extra',
    title: '',
    description: '',
    startDate: new Date().toISOString().slice(0, 10),
    quantity: '',
    unit: 'horas',
  });

  const { data: employees } = useQuery({
    queryKey: ['people', 'employees', 'select'],
    queryFn: () => apiList<{ id: string; fullName: string }>('/people/employees', { limit: 200 }),
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/leaves/events', {
        employeeId: form.employeeId,
        eventType: form.eventType,
        title: form.title,
        description: form.description || null,
        startDate: form.startDate,
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit || null,
        fileIds: [],
      }),
    onSuccess: () => {
      toast.success('Novedad registrada');
      void queryClient.invalidateQueries({ queryKey: ['leaves', 'events'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar novedad</DialogTitle>
          <DialogDescription>
            Las cantidades son informativas y se exportan a la nomina externa sin ningun calculo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colaborador" required>
            <NativeSelect
              value={form.employeeId}
              onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
            >
              <option value="">Seleccione...</option>
              {(employees?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo" required>
              <NativeSelect
                value={form.eventType}
                onChange={(event) => setForm({ ...form, eventType: event.target.value })}
              >
                <option value="horas_extra">Horas extra (informativo)</option>
                <option value="incapacidad_prolongada">Incapacidad prolongada</option>
                <option value="prestamo_equipo">Prestamo de equipo</option>
                <option value="sancion">Sancion</option>
                <option value="felicitacion">Felicitacion</option>
                <option value="comision">Comision</option>
              </NativeSelect>
            </Field>
            <Field label="Fecha" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Titulo" required>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cantidad (informativa)">
              <Input
                type="number"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
            </Field>
            <Field label="Unidad">
              <Input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Descripcion">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.employeeId || !form.title}
            onClick={() => create.mutate()}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
