import { MODULE_CATALOG, SCOPES, type PermissionDefinition, type Scope } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import * as React from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
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
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: Scope;
  isSystem: boolean;
  permissions: Array<{ scope: Scope | null; permission: { code: string } }>;
  modules: Array<{ isVisible: boolean; module: { key: string } }>;
  _count: { users: number };
}

const SCOPE_LABELS: Record<Scope, string> = {
  own: 'Propios',
  team: 'Su equipo',
  area: 'Su area',
  company: 'Toda la empresa',
};

export function RolesTab() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<Role | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => apiGet<Role[]>('/users/roles/all'),
  });

  const remove = useMutation({
    mutationFn: (role: Role) => apiDelete(`/users/roles/${role.id}`),
    onSuccess: () => {
      toast.success('Rol eliminado');
      void queryClient.invalidateQueries({ queryKey: ['users', 'roles'] });
      setRemoving(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cada permiso tiene la forma <span className="font-mono">modulo.recurso.accion</span> y un
          alcance de datos. Los roles del sistema no se pueden modificar.
        </p>
        {can('settings.role.create') ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nuevo rol
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(roles ?? []).map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {role.isSystem ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                    <span className="truncate">{role.name}</span>
                  </CardTitle>
                  {role.description ? (
                    <CardDescription className="line-clamp-2">{role.description}</CardDescription>
                  ) : null}
                </div>
                <Badge tone={role.isSystem ? 'muted' : 'info'}>
                  {role.isSystem ? 'Sistema' : 'Personalizado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="muted">Alcance: {SCOPE_LABELS[role.scope]}</Badge>
                <Badge tone="muted">{role.permissions.length} permisos</Badge>
                <Badge tone="muted">{role.modules.filter((m) => m.isVisible).length} modulos</Badge>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {role._count.users} usuarios asignados
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                  <Pencil className="h-4 w-4" />
                  {role.isSystem ? 'Ver permisos' : 'Editar'}
                </Button>
                {!role.isSystem && can('settings.role.delete') ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(role)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {creating ? <RoleDialog open onOpenChange={() => setCreating(false)} /> : null}
      {editing ? <RoleDialog open onOpenChange={() => setEditing(null)} role={editing} /> : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar rol"
        description={`Se eliminara «${removing?.name ?? ''}». Los usuarios que solo tengan este rol quedaran sin permisos.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role;
}) {
  const queryClient = useQueryClient();
  const t = useT();
  const readOnly = Boolean(role?.isSystem);

  const [form, setForm] = React.useState({
    name: role?.name ?? '',
    description: role?.description ?? '',
    scope: (role?.scope ?? 'own') as Scope,
  });
  const [selected, setSelected] = React.useState<Record<string, Scope | null>>(() =>
    Object.fromEntries(
      (role?.permissions ?? []).map((grant) => [grant.permission.code, grant.scope]),
    ),
  );
  const [modules, setModules] = React.useState<string[]>(
    (role?.modules ?? []).filter((entry) => entry.isVisible).map((entry) => entry.module.key),
  );
  const [filter, setFilter] = React.useState('');

  const { data: catalog } = useQuery({
    queryKey: ['settings', 'permissions'],
    queryFn: () => apiGet<PermissionDefinition[]>('/settings/permissions'),
  });

  const save = useMutation({
    mutationFn: () =>
      apiPost('/users/roles', {
        ...(role ? { id: role.id } : {}),
        name: form.name,
        description: form.description || null,
        scope: form.scope,
        permissions: Object.entries(selected).map(([code, scope]) => ({
          code,
          ...(scope ? { scope } : {}),
        })),
        modules,
      }),
    onSuccess: () => {
      toast.success(role ? 'Rol actualizado' : 'Rol creado');
      void queryClient.invalidateQueries({ queryKey: ['users', 'roles'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar el rol', error.message),
  });

  const byModule = React.useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of catalog ?? []) {
      if (
        filter &&
        !`${permission.code} ${permission.label}`.toLowerCase().includes(filter.toLowerCase())
      ) {
        continue;
      }
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return groups;
  }, [catalog, filter]);

  const togglePermission = (code: string) => {
    if (readOnly) return;
    setSelected((current) => {
      const next = { ...current };
      if (code in next) delete next[code];
      else next[code] = null;
      return next;
    });
  };

  const toggleModulePermissions = (moduleKey: string, checked: boolean) => {
    if (readOnly) return;
    const codes = (byModule.get(moduleKey) ?? []).map((permission) => permission.code);
    setSelected((current) => {
      const next = { ...current };
      for (const code of codes) {
        if (checked) next[code] = next[code] ?? null;
        else delete next[code];
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{role ? role.name : 'Nuevo rol'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre" required>
              <Input
                value={form.name}
                disabled={readOnly}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field
              label="Alcance de datos por defecto"
              hint="Se aplica a los permisos sin alcance propio"
            >
              <NativeSelect
                value={form.scope}
                disabled={readOnly}
                onChange={(event) => setForm({ ...form, scope: event.target.value as Scope })}
              >
                {SCOPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {SCOPE_LABELS[scope]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Buscar permiso">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="people.employee"
              />
            </Field>
          </div>

          <Field label="Descripcion">
            <Textarea
              value={form.description}
              disabled={readOnly}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={2}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium">Modulos visibles</p>
            <div className="flex flex-wrap gap-2">
              {MODULE_CATALOG.map((module) => {
                const active = modules.includes(module.key);
                return (
                  <button
                    key={module.key}
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      setModules((current) =>
                        current.includes(module.key)
                          ? current.filter((item) => item !== module.key)
                          : [...current, module.key],
                      )
                    }
                    className={
                      active
                        ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                        : 'rounded-full border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50'
                    }
                  >
                    {t(module.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-md border p-3">
            {[...byModule.entries()].map(([moduleKey, permissions]) => {
              const allSelected = permissions.every((permission) => permission.code in selected);
              return (
                <div key={moduleKey}>
                  <label className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <Checkbox
                      checked={allSelected}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        toggleModulePermissions(moduleKey, checked === true)
                      }
                    />
                    {t(`modules.${moduleKey}`)}
                  </label>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.map((permission) => (
                      <div key={permission.code} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={permission.code in selected}
                          disabled={readOnly}
                          onCheckedChange={() => togglePermission(permission.code)}
                        />
                        <span className="min-w-0 flex-1 truncate" title={permission.code}>
                          {permission.label}
                          {permission.sensitive ? (
                            <Lock
                              className="ml-1 inline h-3 w-3 text-amber-500"
                              aria-label="Dato sensible"
                            />
                          ) : null}
                        </span>
                        {permission.code in selected ? (
                          <select
                            value={selected[permission.code] ?? ''}
                            disabled={readOnly}
                            onChange={(event) =>
                              setSelected({
                                ...selected,
                                [permission.code]: (event.target.value || null) as Scope | null,
                              })
                            }
                            className="h-7 rounded border border-input bg-background px-1 text-xs"
                            aria-label={`Alcance de ${permission.code}`}
                          >
                            <option value="">Por defecto</option>
                            {SCOPES.map((scope) => (
                              <option key={scope} value={scope}>
                                {SCOPE_LABELS[scope]}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {Object.keys(selected).length} permisos seleccionados.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!readOnly ? (
            <Button
              loading={save.isPending}
              disabled={!form.name.trim()}
              onClick={() => save.mutate()}
            >
              Guardar rol
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
