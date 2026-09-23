import { requisitionSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
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

interface RequisitionRow {
  id: string;
  code: string;
  title: string;
  reason: string;
  openings: number;
  neededBy: string | null;
  status: string;
  createdAt: string;
}

export function RequisitionsPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'requisitions', { page, status }],
    queryFn: () => apiList<RequisitionRow>('/recruiting/requisitions', { page, limit: 25, status }),
  });

  const columns: Array<Column<RequisitionRow>> = [
    {
      key: 'title',
      header: 'Requisicion',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      hideOnMobile: true,
      render: (row) => <Badge tone="muted">{row.reason.replace(/_/g, ' ')}</Badge>,
    },
    { key: 'openings', header: 'Cupos' },
    {
      key: 'neededBy',
      header: 'Requerida para',
      hideOnMobile: true,
      render: (row) => formatDate(row.neededBy),
    },
    {
      key: 'createdAt',
      header: 'Solicitada',
      hideOnMobile: true,
      render: (row) => formatDate(row.createdAt),
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
        title="Requisiciones de personal"
        description="El area solicita, Talento Humano valida y gerencia aprueba."
        actions={
          can('recruiting.requisition.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva requisicion
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
        emptyTitle="Sin requisiciones"
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
            <option value="pending_approval">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="published">Publicadas</option>
          </NativeSelect>
        }
      />

      <CreateRequisitionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateRequisitionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, any>>({
    title: '',
    reason: 'nuevo_cargo',
    openings: 1,
    justification: '',
    contractType: 'indefinido',
  });

  const { data: options } = useQuery({
    queryKey: ['organization', 'options'],
    queryFn: async () => {
      const [departments, positions, locations] = await Promise.all([
        apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
        apiGet<Array<{ id: string; name: string }>>('/organization/positions'),
        apiGet<Array<{ id: string; name: string }>>('/organization/locations'),
      ]);
      return { departments, positions, locations };
    },
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost('/recruiting/requisitions', payload),
    onSuccess: () => {
      toast.success('Requisicion enviada', 'Se inicio el flujo de aprobacion.');
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'requisitions'] });
      onOpenChange(false);
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva requisicion de personal</DialogTitle>
          <DialogDescription>
            Al enviarla se dispara el flujo configurado de aprobacion.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titulo del cargo solicitado" required className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Motivo" required>
            <NativeSelect
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            >
              <option value="nuevo_cargo">Nuevo cargo</option>
              <option value="reemplazo">Reemplazo</option>
              <option value="temporal">Necesidad temporal</option>
              <option value="crecimiento">Crecimiento del area</option>
            </NativeSelect>
          </Field>
          <Field label="Numero de cupos">
            <Input
              type="number"
              min={1}
              value={form.openings}
              onChange={(event) => setForm({ ...form, openings: event.target.value })}
            />
          </Field>
          <Field label="Area">
            <NativeSelect
              value={form.departmentId ?? ''}
              onChange={(event) =>
                setForm({ ...form, departmentId: event.target.value || undefined })
              }
            >
              <option value="">Sin asignar</option>
              {(options?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cargo">
            <NativeSelect
              value={form.positionId ?? ''}
              onChange={(event) =>
                setForm({ ...form, positionId: event.target.value || undefined })
              }
            >
              <option value="">Sin asignar</option>
              {(options?.positions ?? []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Requerida para">
            <Input
              type="date"
              value={form.neededBy ?? ''}
              onChange={(event) => setForm({ ...form, neededBy: event.target.value || undefined })}
            />
          </Field>
          <Field label="Tipo de contrato">
            <NativeSelect
              value={form.contractType}
              onChange={(event) => setForm({ ...form, contractType: event.target.value })}
            >
              <option value="indefinido">Termino indefinido</option>
              <option value="fijo">Termino fijo</option>
              <option value="obra_labor">Obra o labor</option>
            </NativeSelect>
          </Field>
          <Field label="Justificacion" className="sm:col-span-2">
            <Textarea
              value={form.justification}
              onChange={(event) => setForm({ ...form, justification: event.target.value })}
              rows={3}
            />
          </Field>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              setError(null);
              const parsed = requisitionSchema.safeParse({
                ...form,
                openings: Number(form.openings),
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              create.mutate(parsed.data);
            }}
          >
            Enviar requisicion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
