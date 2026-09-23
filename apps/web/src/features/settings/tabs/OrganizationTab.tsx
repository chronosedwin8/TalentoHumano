import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Trash2, Wallet } from 'lucide-react';
import * as React from 'react';
import { EmployeePicker } from '@/components/EmployeePicker';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  NativeSelect,
  Textarea,
} from '@/components/ui/primitives';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';

interface Location {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  timezone: string;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  managerId: string | null;
  path: string | null;
  isActive: boolean;
  children?: Department[];
}

interface Position {
  id: string;
  name: string;
  code: string | null;
  departmentId: string | null;
  level: string | null;
  description: string | null;
  isActive: boolean;
}

interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export function OrganizationTab() {
  return (
    <Tabs defaultValue="areas">
      <TabsList>
        <TabsTrigger value="areas">Areas</TabsTrigger>
        <TabsTrigger value="cargos">Cargos</TabsTrigger>
        <TabsTrigger value="sedes">Sedes</TabsTrigger>
        <TabsTrigger value="centros">Centros de costo</TabsTrigger>
      </TabsList>
      <TabsContent value="areas">
        <DepartmentsSection />
      </TabsContent>
      <TabsContent value="cargos">
        <PositionsSection />
      </TabsContent>
      <TabsContent value="sedes">
        <LocationsSection />
      </TabsContent>
      <TabsContent value="centros">
        <CostCentersSection />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------- departments ------------------------------ */

function DepartmentsSection() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<Department | null>(null);
  const [form, setForm] = React.useState({ name: '', code: '', parentId: '', managerId: '' });

  const { data: tree } = useQuery({
    queryKey: ['organization', 'departments', 'tree'],
    queryFn: () => apiGet<Department[]>('/organization/departments/tree'),
  });

  const { data: flat } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Department[]>('/organization/departments'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/organization/departments', {
        name: form.name,
        code: form.code,
        parentId: form.parentId || null,
        managerId: form.managerId || null,
      }),
    onSuccess: () => {
      toast.success('Area creada');
      void queryClient.invalidateQueries({ queryKey: ['organization'] });
      setCreating(false);
      setForm({ name: '', code: '', parentId: '', managerId: '' });
    },
    onError: (error: Error) => toast.error('No fue posible crear el area', error.message),
  });

  const remove = useMutation({
    mutationFn: (department: Department) => apiDelete(`/organization/departments/${department.id}`),
    onSuccess: () => {
      toast.success('Area eliminada');
      void queryClient.invalidateQueries({ queryKey: ['organization'] });
      setRemoving(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  const renderNode = (node: Department, depth = 0): React.ReactNode => (
    <React.Fragment key={node.id}>
      <div
        className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
        style={{ marginLeft: depth * 20 }}
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        <Badge tone="muted">{node.code}</Badge>
        {!node.isActive ? <Badge tone="warning">Inactiva</Badge> : null}
        {can('settings.department.delete') ? (
          <Button size="sm" variant="ghost" onClick={() => setRemoving(node)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {(node.children ?? []).map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Estructura de areas</CardTitle>
            <CardDescription>
              La jerarquia define el alcance de datos «area» de los permisos.
            </CardDescription>
          </div>
          {can('settings.department.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva area
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {(tree ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay areas creadas.</p>
        ) : (
          tree?.map((node) => renderNode(node))
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva area</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" required>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Codigo" required>
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                />
              </Field>
            </div>
            <Field label="Area superior">
              <NativeSelect
                value={form.parentId}
                onChange={(event) => setForm({ ...form, parentId: event.target.value })}
              >
                <option value="">Sin area superior</option>
                {(flat ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Responsable del area">
              <EmployeePicker
                value={form.managerId || null}
                onChange={(id) => setForm({ ...form, managerId: id ?? '' })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name.trim() || !form.code.trim()}
              onClick={() => create.mutate()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar area"
        description={`Se eliminara «${removing?.name ?? ''}». Los colaboradores asignados quedaran sin area.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </Card>
  );
}

/* -------------------------------- positions ------------------------------- */

function PositionsSection() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    code: '',
    departmentId: '',
    level: '',
    description: '',
  });

  const { data: positions } = useQuery({
    queryKey: ['organization', 'positions'],
    queryFn: () => apiGet<Position[]>('/organization/positions'),
  });

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Department[]>('/organization/departments'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/organization/positions', {
        ...form,
        departmentId: form.departmentId || null,
        level: form.level || null,
        description: form.description || null,
      }),
    onSuccess: () => {
      toast.success('Cargo creado');
      void queryClient.invalidateQueries({ queryKey: ['organization', 'positions'] });
      setCreating(false);
      setForm({ name: '', code: '', departmentId: '', level: '', description: '' });
    },
    onError: (error: Error) => toast.error('No fue posible crear el cargo', error.message),
  });

  const departmentName = (id: string | null) =>
    (departments ?? []).find((department) => department.id === id)?.name ?? 'Sin area';

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Cargos</CardTitle>
            <CardDescription>
              Perfil del cargo con su proposito y competencias asociadas.
            </CardDescription>
          </div>
          {can('settings.position.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nuevo cargo
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {(positions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay cargos creados.</p>
        ) : (
          positions?.map((position) => (
            <div key={position.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{position.name}</span>
                <Badge tone="muted">{position.code}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {departmentName(position.departmentId)}
                {position.level ? ` · ${position.level}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Titulo" required>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Codigo" required>
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Area">
                <NativeSelect
                  value={form.departmentId}
                  onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                >
                  <option value="">Sin area</option>
                  {(departments ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Nivel">
                <Input
                  value={form.level}
                  onChange={(event) => setForm({ ...form, level: event.target.value })}
                  placeholder="Operativo, tactico, directivo"
                />
              </Field>
            </div>
            <Field label="Proposito del cargo">
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name.trim() || !form.code.trim()}
              onClick={() => create.mutate()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------------------- locations ------------------------------- */

function LocationsSection() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    code: '',
    city: '',
    address: '',
    timezone: 'America/Bogota',
  });

  const { data } = useQuery({
    queryKey: ['organization', 'locations'],
    queryFn: () => apiGet<Location[]>('/organization/locations'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/organization/locations', {
        ...form,
        city: form.city || null,
        address: form.address || null,
      }),
    onSuccess: () => {
      toast.success('Sede creada');
      void queryClient.invalidateQueries({ queryKey: ['organization', 'locations'] });
      setCreating(false);
      setForm({ name: '', code: '', city: '', address: '', timezone: 'America/Bogota' });
    },
    onError: (error: Error) => toast.error('No fue posible crear la sede', error.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Sedes</CardTitle>
            <CardDescription>
              Cada sede tiene su zona horaria y su calendario de festivos.
            </CardDescription>
          </div>
          {can('settings.location.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva sede
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay sedes registradas.</p>
        ) : (
          data?.map((location) => (
            <div key={location.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{location.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {location.city ?? '—'} · {location.timezone}
                </p>
              </div>
              <Badge tone="muted">{location.code}</Badge>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva sede</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Codigo" required>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Ciudad">
              <Input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </Field>
            <Field label="Zona horaria">
              <Input
                value={form.timezone}
                onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              />
            </Field>
            <Field label="Direccion" className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name.trim() || !form.code.trim()}
              onClick={() => create.mutate()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------ cost centers ------------------------------ */

function CostCentersSection() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', code: '' });

  const { data } = useQuery({
    queryKey: ['organization', 'cost-centers'],
    queryFn: () => apiGet<CostCenter[]>('/organization/cost-centers'),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => apiPost('/organization/cost-centers', form),
    onSuccess: () => {
      toast.success('Centro de costo creado');
      void queryClient.invalidateQueries({ queryKey: ['organization', 'cost-centers'] });
      setCreating(false);
      setForm({ name: '', code: '' });
    },
    onError: (error: Error) => toast.error('No fue posible crear', error.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Centros de costo</CardTitle>
            <CardDescription>
              Solo se usan para clasificar y exportar; el sistema no realiza calculos de nomina.
            </CardDescription>
          </div>
          {can('settings.costcenter.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nuevo centro
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay centros de costo.</p>
        ) : (
          data?.map((center) => (
            <div key={center.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{center.name}</span>
              <Badge tone="muted">{center.code}</Badge>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo centro de costo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Codigo" required>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name.trim() || !form.code.trim()}
              onClick={() => create.mutate()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
