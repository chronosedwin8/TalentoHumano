import type { ModuleDefinition } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiPost } from '@/lib/api';
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
  Skeleton,
} from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';

interface ModuleMatrix {
  catalog: ModuleDefinition[];
  company: Array<{ moduleKey: string; isEnabled: boolean }>;
  roles: Array<{
    roleId: string;
    roleKey: string;
    roleName: string;
    modules: Array<{ moduleKey: string; isVisible: boolean }>;
  }>;
  users: Array<{ userId: string; moduleKey: string; isVisible: boolean | null }>;
}

/**
 * A module is visible to a user when the company enables it AND one of their
 * roles makes it visible; a per-user override can force it on or off.
 */
export function ModulesTab() {
  const queryClient = useQueryClient();
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: () => apiGet<ModuleMatrix>('/settings/modules'),
  });

  const [company, setCompany] = React.useState<Record<string, boolean>>({});
  const [roleMatrix, setRoleMatrix] = React.useState<Record<string, Record<string, boolean>>>({});

  React.useEffect(() => {
    if (!data) return;
    setCompany(Object.fromEntries(data.company.map((entry) => [entry.moduleKey, entry.isEnabled])));
    setRoleMatrix(
      Object.fromEntries(
        data.roles.map((role) => [
          role.roleId,
          Object.fromEntries(role.modules.map((entry) => [entry.moduleKey, entry.isVisible])),
        ]),
      ),
    );
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPost('/settings/modules', {
        companyModules: Object.entries(company).map(([moduleKey, isEnabled]) => ({
          moduleKey,
          isEnabled,
        })),
        roleModules: Object.entries(roleMatrix).flatMap(([roleId, modules]) =>
          Object.entries(modules).map(([moduleKey, isVisible]) => ({
            roleId,
            moduleKey,
            isVisible,
          })),
        ),
        userModules: [],
      }),
    onSuccess: () => {
      toast.success('Matriz de modulos guardada', 'Los menus se actualizan en el proximo ingreso.');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'modules'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Modulos activos en la empresa</CardTitle>
          <CardDescription>
            Un modulo desactivado desaparece del menu y sus endpoints responden 403.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.catalog.map((module) => (
            <label
              key={module.key}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{t(module.labelKey)}</span>
                {module.core ? <Badge tone="muted">Base</Badge> : null}
              </span>
              <Switch
                checked={module.core ? true : (company[module.key] ?? false)}
                disabled={module.core}
                onCheckedChange={(checked) => setCompany({ ...company, [module.key]: checked })}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visibilidad por rol</CardTitle>
          <CardDescription>
            Marque que modulos ve cada rol. Los permisos siguen decidiendo que puede hacer dentro.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 text-left font-medium">Rol</th>
                {data.catalog.map((module) => (
                  <th key={module.key} className="px-1 pb-2 text-center text-xs font-medium">
                    <span className="block max-w-[72px] truncate" title={t(module.labelKey)}>
                      {t(module.labelKey)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.roles.map((role) => (
                <tr key={role.roleId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{role.roleName}</td>
                  {data.catalog.map((module) => (
                    <td key={module.key} className="px-1 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={roleMatrix[role.roleId]?.[module.key] ?? false}
                        disabled={!company[module.key] && !module.core}
                        onChange={(event) =>
                          setRoleMatrix({
                            ...roleMatrix,
                            [role.roleId]: {
                              ...(roleMatrix[role.roleId] ?? {}),
                              [module.key]: event.target.checked,
                            },
                          })
                        }
                        className="h-4 w-4 rounded border-input"
                        aria-label={`${role.roleName} · ${t(module.labelKey)}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" />
          Guardar matriz
        </Button>
      </div>
    </div>
  );
}
