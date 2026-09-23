import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import { Badge, Button, Field, Input, NativeSelect, PageHeader } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface AssetRow {
  id: string;
  name: string;
  code: string;
  assetType: string;
  serialNumber: string | null;
  brand: string | null;
  status: string;
  purchaseDate: string | null;
  assignments: Array<{ id: string; employee: { id: string; fullName: string } }>;
}

export function AssetsPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'assets', { page, debounced, status }],
    queryFn: () =>
      apiList<AssetRow>('/people/assets', { page, limit: 25, search: debounced, status }),
  });

  const columns: Array<Column<AssetRow>> = [
    {
      key: 'name',
      header: 'Activo',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.code}
            {row.serialNumber ? ` · serie ${row.serialNumber}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'assetType', header: 'Tipo', hideOnMobile: true },
    { key: 'brand', header: 'Marca', hideOnMobile: true, render: (row) => row.brand ?? '—' },
    {
      key: 'assignedTo',
      header: 'Asignado a',
      render: (row) =>
        row.assignments[0]?.employee.fullName ?? (
          <span className="text-muted-foreground">Disponible</span>
        ),
    },
    {
      key: 'purchaseDate',
      header: 'Compra',
      hideOnMobile: true,
      render: (row) => formatDate(row.purchaseDate),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge
          tone={
            row.status === 'assigned' ? 'info' : row.status === 'available' ? 'success' : 'muted'
          }
        >
          {row.status === 'assigned'
            ? 'Asignado'
            : row.status === 'available'
              ? 'Disponible'
              : row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activos"
        description="Inventario de equipos y dotacion entregada a los colaboradores."
        actions={
          can('people.asset.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar activo
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
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, codigo o serie"
        emptyTitle="Sin activos registrados"
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="">Todos</option>
            <option value="available">Disponibles</option>
            <option value="assigned">Asignados</option>
            <option value="maintenance">En mantenimiento</option>
          </NativeSelect>
        }
      />

      <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateAssetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    assetType: 'laptop',
    name: '',
    code: '',
    serialNumber: '',
    brand: '',
    purchaseDate: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/people/assets', {
        ...form,
        serialNumber: form.serialNumber || null,
        brand: form.brand || null,
        purchaseDate: form.purchaseDate || null,
      }),
    onSuccess: () => {
      toast.success('Activo registrado');
      void queryClient.invalidateQueries({ queryKey: ['people', 'assets'] });
      onOpenChange(false);
      setForm({
        assetType: 'laptop',
        name: '',
        code: '',
        serialNumber: '',
        brand: '',
        purchaseDate: '',
      });
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar activo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <NativeSelect
              value={form.assetType}
              onChange={(event) => setForm({ ...form, assetType: event.target.value })}
            >
              <option value="laptop">Portatil</option>
              <option value="celular">Celular</option>
              <option value="monitor">Monitor</option>
              <option value="dotacion">Dotacion</option>
              <option value="llaves">Llaves y accesos</option>
              <option value="tarjeta">Tarjeta corporativa</option>
            </NativeSelect>
          </Field>
          <Field label="Codigo interno" required>
            <Input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </Field>
          <Field label="Nombre" required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Marca">
            <Input
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
            />
          </Field>
          <Field label="Numero de serie">
            <Input
              value={form.serialNumber}
              onChange={(event) => setForm({ ...form, serialNumber: event.target.value })}
            />
          </Field>
          <Field label="Fecha de compra">
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.name || !form.code}
            onClick={() => create.mutate()}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
