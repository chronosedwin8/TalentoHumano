import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
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
} from '@/components/ui/primitives';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@/components/ui/overlays';

interface CatalogKey {
  key: string;
  label: string;
}

interface CatalogItem {
  id: string;
  catalogKey: string;
  code: string;
  label: string;
  description: string | null;
  color: string | null;
  position: number;
  isActive: boolean;
}

export function CatalogsTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<CatalogItem | null>(null);
  const [form, setForm] = React.useState({ code: '', label: '', description: '', color: '' });

  const { data: catalogs } = useQuery({
    queryKey: ['settings', 'catalogs'],
    queryFn: () => apiGet<CatalogKey[]>('/settings/catalogs'),
  });

  React.useEffect(() => {
    if (!selected && catalogs?.length) setSelected(catalogs[0].key);
  }, [catalogs, selected]);

  const { data: items, isLoading } = useQuery({
    queryKey: ['settings', 'catalogs', selected],
    queryFn: () => apiGet<CatalogItem[]>(`/settings/catalogs/${selected}`),
    enabled: Boolean(selected),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['settings', 'catalogs', selected] });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/settings/catalogs', {
        catalogKey: selected,
        code: form.code,
        label: form.label,
        description: form.description || null,
        color: form.color || null,
        position: (items?.length ?? 0) + 1,
        metadata: {},
      }),
    onSuccess: () => {
      toast.success('Elemento agregado');
      void invalidate();
      setCreating(false);
      setForm({ code: '', label: '', description: '', color: '' });
    },
    onError: (error: Error) => toast.error('No fue posible agregar', error.message),
  });

  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      apiPatch(`/settings/catalogs/${item.id}`, { isActive: !item.isActive }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error('No fue posible actualizar', error.message),
  });

  const remove = useMutation({
    mutationFn: (item: CatalogItem) => apiDelete(`/settings/catalogs/${item.id}`),
    onSuccess: () => {
      toast.success('Elemento eliminado');
      void invalidate();
      setRemoving(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  const currentLabel = (catalogs ?? []).find((catalog) => catalog.key === selected)?.label ?? '';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Catalogos configurables</CardTitle>
            <CardDescription>
              Listas desplegables que la empresa administra sin tocar el codigo.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="w-64"
            >
              {(catalogs ?? []).map((catalog) => (
                <option key={catalog.key} value={catalog.key}>
                  {catalog.label}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" onClick={() => setCreating(true)} disabled={!selected}>
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Este catalogo aun no tiene elementos.</p>
        ) : (
          items?.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              {item.color ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.label}</p>
                {item.description ? (
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </div>
              <Badge tone="muted">{item.code}</Badge>
              <Switch checked={item.isActive} onCheckedChange={() => toggle.mutate(item)} />
              <Button size="sm" variant="ghost" onClick={() => setRemoving(item)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a «{currentLabel}»</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Etiqueta" required>
                <Input
                  value={form.label}
                  onChange={(event) => setForm({ ...form, label: event.target.value })}
                />
              </Field>
              <Field label="Codigo" required hint="Valor que se guarda en la base de datos">
                <Input
                  value={form.code}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      code: event.target.value.toLowerCase().replace(/\s+/g, '_'),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Descripcion">
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <Field label="Color">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color || '#2a78d6'}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                  className="h-10 w-14 rounded-md border border-input"
                />
                <Input
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.code.trim() || !form.label.trim()}
              onClick={() => create.mutate()}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar elemento"
        description={`Se eliminara «${removing?.label ?? ''}». Los registros que ya lo usan conservan el valor.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </Card>
  );
}
