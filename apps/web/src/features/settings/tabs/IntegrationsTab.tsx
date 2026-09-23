import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react';
import * as React from 'react';
import { apiDelete, apiGet, apiList, apiPost } from '@/lib/api';
import { formatDate, relativeTime } from '@/lib/utils';
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

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

export function IntegrationsTab() {
  const queryClient = useQueryClient();
  const [creatingKey, setCreatingKey] = React.useState(false);
  const [creatingHook, setCreatingHook] = React.useState(false);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [removingKey, setRemovingKey] = React.useState<ApiKey | null>(null);
  const [removingHook, setRemovingHook] = React.useState<WebhookRow | null>(null);
  const [inspecting, setInspecting] = React.useState<WebhookRow | null>(null);

  const { data: keys } = useQuery({
    queryKey: ['integrations', 'api-keys'],
    queryFn: () => apiGet<ApiKey[]>('/integrations/api-keys'),
  });

  const { data: hooks } = useQuery({
    queryKey: ['integrations', 'webhooks'],
    queryFn: () => apiGet<WebhookRow[]>('/integrations/webhooks'),
  });

  const { data: events } = useQuery({
    queryKey: ['integrations', 'events'],
    queryFn: () => apiGet<string[]>('/integrations/events'),
  });

  const revokeKey = useMutation({
    mutationFn: (key: ApiKey) => apiDelete(`/integrations/api-keys/${key.id}`),
    onSuccess: () => {
      toast.success('API key revocada');
      void queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys'] });
      setRemovingKey(null);
    },
    onError: (error: Error) => toast.error('No fue posible revocar', error.message),
  });

  const removeHook = useMutation({
    mutationFn: (hook: WebhookRow) => apiDelete(`/integrations/webhooks/${hook.id}`),
    onSuccess: () => {
      toast.success('Webhook eliminado');
      void queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks'] });
      setRemovingHook(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">API keys</CardTitle>
              <CardDescription>
                La clave se muestra una sola vez al crearla; despues solo queda su prefijo.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreatingKey(true)}>
              <Plus className="h-4 w-4" />
              Nueva API key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(keys ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aun no hay API keys creadas.</p>
          ) : (
            keys?.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{key.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}…
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {key.lastUsedAt ? `Usada ${relativeTime(key.lastUsedAt)}` : 'Sin uso'}
                </span>
                {key.expiresAt ? (
                  <Badge tone="muted">Vence {formatDate(key.expiresAt)}</Badge>
                ) : null}
                <Badge tone={key.isActive ? 'success' : 'muted'}>
                  {key.isActive ? 'Activa' : 'Revocada'}
                </Badge>
                {key.isActive ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemovingKey(key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Webhooks</CardTitle>
              <CardDescription>
                Cada entrega se firma con HMAC-SHA256 en la cabecera{' '}
                <span className="font-mono">X-Talento-Signature</span>.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreatingHook(true)}>
              <Plus className="h-4 w-4" />
              Nuevo webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(hooks ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aun no hay webhooks configurados.</p>
          ) : (
            hooks?.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{hook.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{hook.url}</p>
                </div>
                <Badge tone="muted">{hook.events.length} eventos</Badge>
                <Button size="sm" variant="ghost" onClick={() => setInspecting(hook)}>
                  Entregas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemovingHook(hook)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {creatingKey ? (
        <ApiKeyDialog open onOpenChange={() => setCreatingKey(false)} onCreated={setRevealed} />
      ) : null}
      {creatingHook ? (
        <WebhookDialog open onOpenChange={() => setCreatingHook(false)} events={events ?? []} />
      ) : null}
      {inspecting ? (
        <DeliveriesDialog open onOpenChange={() => setInspecting(null)} webhook={inspecting} />
      ) : null}

      <Dialog open={Boolean(revealed)} onOpenChange={() => setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guarde esta clave ahora</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No volvera a mostrarse. Si la pierde debera crear una nueva.
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="min-w-0 flex-1 break-all text-xs">{revealed}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealed ?? '');
                toast.success('Clave copiada');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>Ya la guarde</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removingKey)}
        onOpenChange={(open) => !open && setRemovingKey(null)}
        title="Revocar API key"
        description={`Las integraciones que usen «${removingKey?.name ?? ''}» dejaran de funcionar de inmediato.`}
        confirmLabel="Revocar"
        tone="destructive"
        onConfirm={() => {
          if (removingKey) revokeKey.mutate(removingKey);
        }}
      />

      <ConfirmDialog
        open={Boolean(removingHook)}
        onOpenChange={(open) => !open && setRemovingHook(null)}
        title="Eliminar webhook"
        description={`Se dejaran de enviar eventos a «${removingHook?.url ?? ''}».`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (removingHook) removeHook.mutate(removingHook);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ name: '', expiresAt: '' });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ key: string }>('/integrations/api-keys', {
        name: form.name,
        permissions: [],
        expiresAt: form.expiresAt || null,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys'] });
      onOpenChange(false);
      onCreated(result.key);
    },
    onError: (error: Error) => toast.error('No fue posible crear la API key', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva API key</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Integracion con nomina"
            />
          </Field>
          <Field label="Vence el">
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.name.trim()}
            onClick={() => create.mutate()}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebhookDialog({
  open,
  onOpenChange,
  events,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: string[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ name: '', url: '' });
  const [selected, setSelected] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState('');

  const create = useMutation({
    mutationFn: () => apiPost('/integrations/webhooks', { ...form, events: selected }),
    onSuccess: () => {
      toast.success('Webhook registrado');
      void queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  const visible = events.filter((event) => !filter || event.includes(filter.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nombre" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="URL de destino" required>
            <Input
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="Eventos" hint={`${selected.length} seleccionados`}>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar eventos"
            />
          </Field>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
            {visible.map((event) => (
              <label key={event} className="flex items-center gap-2 font-mono text-xs">
                <Checkbox
                  checked={selected.includes(event)}
                  onCheckedChange={() =>
                    setSelected((current) =>
                      current.includes(event)
                        ? current.filter((item) => item !== event)
                        : [...current, event],
                    )
                  }
                />
                {event}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.name.trim() || !form.url.trim() || !selected.length}
            onClick={() => create.mutate()}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({
  open,
  onOpenChange,
  webhook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookRow;
}) {
  const { data } = useQuery({
    queryKey: ['integrations', 'webhooks', webhook.id, 'deliveries'],
    queryFn: () =>
      apiList<{
        id: string;
        event: string;
        status: string;
        statusCode: number | null;
        attempt: number;
        createdAt: string;
      }>(`/integrations/webhooks/${webhook.id}/deliveries`, { limit: 50 }),
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entregas de «{webhook.name}»</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
          {(data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin entregas registradas.</p>
          ) : (
            data?.data.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{delivery.event}</span>
                <span className="text-xs text-muted-foreground">intento {delivery.attempt}</span>
                <Badge tone={delivery.status === 'sent' ? 'success' : 'danger'}>
                  {delivery.statusCode ?? delivery.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(delivery.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
