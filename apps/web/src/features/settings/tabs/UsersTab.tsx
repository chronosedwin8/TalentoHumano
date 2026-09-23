import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Power, ShieldCheck, UserPlus } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmployeePicker } from '@/components/EmployeePicker';
import { apiGet, apiList, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { debounce, formatDateTime, relativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import { Avatar, Badge, Button, Field, Input, NativeSelect } from '@/components/ui/primitives';
import {
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface CompanyUser {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    status: string;
    twoFactorEnabled: boolean;
    lastLoginAt: string | null;
    isSuperadmin: boolean;
  };
  roles: Array<{ role: { id: string; key: string; name: string } }>;
}

interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

export function UsersTab() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [inviting, setInviting] = React.useState(false);
  const [editingRoles, setEditingRoles] = React.useState<CompanyUser | null>(null);
  const [toggling, setToggling] = React.useState<CompanyUser | null>(null);

  const push = React.useMemo(
    () =>
      debounce((value: string) => {
        setDebounced(value);
        setPage(1);
      }, 350),
    [],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debounced, status],
    queryFn: () => apiList<CompanyUser>('/users', { page, limit: 25, search: debounced, status }),
  });

  const { data: roles } = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => apiGet<Role[]>('/users/roles/all'),
    enabled: can('settings.role.read'),
    retry: false,
  });

  const setStatusMutation = useMutation({
    mutationFn: (row: CompanyUser) =>
      apiPatch(`/users/${row.user.id}/status`, {
        status: row.user.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => {
      toast.success('Estado actualizado');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setToggling(null);
    },
    onError: (error: Error) => toast.error('No fue posible actualizar', error.message),
  });

  const resetPassword = useMutation({
    mutationFn: (row: CompanyUser) => apiPost(`/users/${row.user.id}/reset-password`, {}),
    onSuccess: () =>
      toast.success('Restablecimiento enviado', 'El usuario recibira un enlace por correo.'),
    onError: (error: Error) => toast.error('No fue posible enviar', error.message),
  });

  const columns: Array<Column<CompanyUser>> = [
    {
      key: 'user',
      header: 'Usuario',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            name={`${row.user.firstName} ${row.user.lastName}`}
            src={row.user.avatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.user.firstName} {row.user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((assignment) => (
            <Badge key={assignment.role.id} tone="muted">
              {assignment.role.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'twoFactorEnabled',
      header: '2FA',
      hideOnMobile: true,
      render: (row) =>
        row.user.twoFactorEnabled ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'lastLoginAt',
      header: 'Ultimo ingreso',
      hideOnMobile: true,
      render: (row) => (row.user.lastLoginAt ? relativeTime(row.user.lastLoginAt) : 'Nunca'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge tone={row.user.status === 'active' ? 'success' : 'muted'}>
          {row.user.status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        can('settings.user.update') ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              title="Cambiar roles"
              onClick={(event) => {
                event.stopPropagation();
                setEditingRoles(row);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Restablecer contrasena"
              onClick={(event) => {
                event.stopPropagation();
                resetPassword.mutate(row);
              }}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title={row.user.status === 'active' ? 'Desactivar' : 'Activar'}
              onClick={(event) => {
                event.stopPropagation();
                setToggling(row);
              }}
            >
              <Power className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          push(value);
        }}
        searchPlaceholder="Buscar por nombre o correo"
        emptyTitle="Sin usuarios"
        toolbar={
          <>
            <NativeSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </NativeSelect>
            {can('settings.user.create') ? (
              <Button size="sm" onClick={() => setInviting(true)}>
                <UserPlus className="h-4 w-4" />
                Invitar usuario
              </Button>
            ) : null}
          </>
        }
      />

      {inviting ? (
        <InviteDialog open onOpenChange={() => setInviting(false)} roles={roles ?? []} />
      ) : null}
      {editingRoles ? (
        <RolesDialog
          open
          onOpenChange={() => setEditingRoles(null)}
          companyUser={editingRoles}
          roles={roles ?? []}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(toggling)}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.user.status === 'active' ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          toggling?.user.status === 'active'
            ? 'El usuario no podra iniciar sesion. Su historial y auditoria se conservan.'
            : 'El usuario podra volver a iniciar sesion con sus roles actuales.'
        }
        confirmLabel={toggling?.user.status === 'active' ? 'Desactivar' : 'Activar'}
        tone={toggling?.user.status === 'active' ? 'destructive' : 'default'}
        onConfirm={() => {
          if (toggling) setStatusMutation.mutate(toggling);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function InviteDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    locale: 'es',
    employeeId: '',
    sendInvitation: true,
  });
  const [roleIds, setRoleIds] = React.useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ temporaryPassword?: string }>('/users', {
        ...form,
        phone: form.phone || null,
        employeeId: form.employeeId || null,
        roleIds,
      }),
    onSuccess: (result) => {
      toast.success(
        'Usuario creado',
        result?.temporaryPassword
          ? `Contrasena temporal: ${result.temporaryPassword}`
          : 'Se envio la invitacion por correo.',
      );
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear el usuario', error.message),
  });

  const toggleRole = (id: string) =>
    setRoleIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
            </Field>
            <Field label="Apellido" required>
              <Input
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </Field>
            <Field label="Correo" required className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Telefono">
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Idioma">
              <NativeSelect
                value={form.locale}
                onChange={(event) => setForm({ ...form, locale: event.target.value })}
              >
                <option value="es">Espanol</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </NativeSelect>
            </Field>
          </div>

          <Field label="Vincular a un colaborador" hint="Habilita el portal del colaborador">
            <EmployeePicker
              value={form.employeeId || null}
              onChange={(id) => setForm({ ...form, employeeId: id ?? '' })}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Roles <span className="text-destructive">*</span>
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  {role.name}
                  {role.isSystem ? <Badge tone="muted">Sistema</Badge> : null}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.sendInvitation}
              onCheckedChange={(checked) => setForm({ ...form, sendInvitation: checked === true })}
            />
            Enviar invitacion por correo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.email.trim() || !form.firstName.trim() || !roleIds.length}
            onClick={() => create.mutate()}
          >
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({
  open,
  onOpenChange,
  companyUser,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyUser: CompanyUser;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [roleIds, setRoleIds] = React.useState<string[]>(
    companyUser.roles.map((assignment) => assignment.role.id),
  );

  const save = useMutation({
    mutationFn: () =>
      apiPost(`/users/${companyUser.user.id}/roles`, { companyUserId: companyUser.id, roleIds }),
    onSuccess: () => {
      toast.success('Roles actualizados', 'Los permisos se recalculan de inmediato.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible actualizar', error.message),
  });

  const toggleRole = (id: string) =>
    setRoleIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Roles de {companyUser.user.firstName} {companyUser.user.lastName}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roleIds.includes(role.id)}
                onCheckedChange={() => toggleRole(role.id)}
              />
              {role.name}
              {role.isSystem ? <Badge tone="muted">Sistema</Badge> : null}
            </label>
          ))}
        </div>
        {companyUser.user.lastLoginAt ? (
          <p className="text-xs text-muted-foreground">
            Ultimo ingreso: {formatDateTime(companyUser.user.lastLoginAt)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Guardar roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
