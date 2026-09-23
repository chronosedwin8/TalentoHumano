import { employeeCreateSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { ApiRequestError, apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  NativeSelect,
  PageHeader,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  status: string;
  hiredAt: string;
  position: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [sort, setSort] = React.useState('fullName');
  const [createOpen, setCreateOpen] = React.useState(false);

  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'employees', { page, debounced, status, departmentId, sort }],
    queryFn: () =>
      apiList<EmployeeRow>('/people/employees', {
        page,
        limit: 25,
        search: debounced,
        status,
        departmentId,
        sort,
      }),
  });

  const columns: Array<Column<EmployeeRow>> = [
    {
      key: 'fullName',
      header: 'Colaborador',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employeeCode', header: 'Codigo', sortable: true, hideOnMobile: true },
    {
      key: 'position',
      header: 'Cargo',
      hideOnMobile: true,
      render: (row) => row.position?.name ?? '—',
    },
    {
      key: 'department',
      header: 'Area',
      hideOnMobile: true,
      render: (row) => row.department?.name ?? '—',
    },
    {
      key: 'hiredAt',
      header: 'Ingreso',
      sortable: true,
      hideOnMobile: true,
      render: (row) => formatDate(row.hiredAt),
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
        title="Colaboradores"
        description="Ficha 360, legajo digital y movimientos de personal."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/people/organigrama">
                <Network className="h-4 w-4" />
                Organigrama
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/people/directorio">
                <Users className="h-4 w-4" />
                Directorio
              </Link>
            </Button>
            {can('people.employee.create') ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo colaborador
              </Button>
            ) : null}
          </>
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
        sort={sort}
        onSortChange={setSort}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, correo o documento"
        onRowClick={(row) => navigate(`/people/employees/${row.id}`)}
        emptyTitle="Sin colaboradores"
        emptyDescription="Cree el primer colaborador o ajuste los filtros de busqueda."
        toolbar={
          <>
            <NativeSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="Estado"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="on_leave">En ausencia</option>
              <option value="inactive">Inactivos</option>
              <option value="pre_hire">Por ingresar</option>
            </NativeSelect>
            <NativeSelect
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
              className="w-48"
              aria-label="Area"
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

      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState<Record<string, any>>({
    firstName: '',
    lastName: '',
    email: '',
    documentType: 'CC',
    documentNumber: '',
    hiredAt: new Date().toISOString().slice(0, 10),
    createUserAccount: true,
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
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>('/people/employees', payload),
    onSuccess: (employee) => {
      toast.success('Colaborador creado');
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      onOpenChange(false);
      navigate(`/people/employees/${employee.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error('Revise los datos', error.message);
      } else {
        toast.error('No fue posible crear el colaborador');
      }
    },
  });

  const submit = () => {
    setErrors({});
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== '' && value !== null),
    );
    const parsed = employeeCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nuevo colaborador</DialogTitle>
          <DialogDescription>
            Al guardar se crea la ficha y, opcionalmente, su usuario de acceso al portal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres" required error={errors.firstName}>
            <Input
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </Field>
          <Field label="Apellidos" required error={errors.lastName}>
            <Input
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </Field>
          <Field label="Tipo de documento" error={errors.documentType}>
            <NativeSelect
              value={form.documentType}
              onChange={(event) => setForm({ ...form, documentType: event.target.value })}
            >
              <option value="CC">Cedula de ciudadania</option>
              <option value="CE">Cedula de extranjeria</option>
              <option value="PA">Pasaporte</option>
              <option value="PEP">PEP</option>
            </NativeSelect>
          </Field>
          <Field label="Numero de documento" required error={errors.documentNumber}>
            <Input
              value={form.documentNumber}
              onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
            />
          </Field>
          <Field label="Correo corporativo" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label="Fecha de ingreso" required error={errors.hiredAt}>
            <Input
              type="date"
              value={form.hiredAt}
              onChange={(event) => setForm({ ...form, hiredAt: event.target.value })}
            />
          </Field>
          <Field label="Cargo">
            <NativeSelect
              value={form.positionId ?? ''}
              onChange={(event) => setForm({ ...form, positionId: event.target.value })}
            >
              <option value="">Sin asignar</option>
              {(options?.positions ?? []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Area">
            <NativeSelect
              value={form.departmentId ?? ''}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            >
              <option value="">Sin asignar</option>
              {(options?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sede">
            <NativeSelect
              value={form.locationId ?? ''}
              onChange={(event) => setForm({ ...form, locationId: event.target.value })}
            >
              <option value="">Sin asignar</option>
              {(options?.locations ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.createUserAccount}
              onChange={(event) => setForm({ ...form, createUserAccount: event.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Crear usuario y enviar invitacion
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Crear colaborador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
