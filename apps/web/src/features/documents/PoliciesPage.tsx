import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, CheckCircle2, Plus, Send } from 'lucide-react';
import * as React from 'react';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPercent } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface PolicyRow {
  id: string;
  title: string;
  code: string;
  category: string | null;
  summary: string | null;
  requiresAck: boolean;
  requiresSignature: boolean;
  currentVersion: number;
  publishedAt: string | null;
  createdAt: string;
  versions: Array<{
    id: string;
    version: number;
    blocks: BlockDocument;
    effectiveFrom: string | null;
  }>;
  _count: { acknowledgements: number };
}

interface MyAcknowledgement {
  id: string;
  acknowledgedAt: string | null;
  signedAt: string | null;
  policy: { id: string; title: string; summary: string | null; requiresSignature: boolean };
  version: { id: string; version: number; blocks: BlockDocument; effectiveFrom: string | null };
}

export function PoliciesPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [reading, setReading] = React.useState<MyAcknowledgement | null>(null);
  const [auditing, setAuditing] = React.useState<PolicyRow | null>(null);
  const queryClient = useQueryClient();

  const { data: mine } = useQuery({
    queryKey: ['documents', 'policies', 'mine'],
    queryFn: () => apiGet<MyAcknowledgement[]>('/documents/policies/mine'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'policies', page],
    queryFn: () => apiList<PolicyRow>('/documents/policies', { page, limit: 25 }),
    enabled: can('documents.policy.read'),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: (policy: PolicyRow) =>
      apiPost<{ notified: number }>(`/documents/policies/${policy.id}/publish`, {
        versionId: policy.versions[0]?.id,
      }),
    onSuccess: (result) => {
      toast.success(
        'Politica publicada',
        `${result?.notified ?? 0} colaboradores deben acusar lectura.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['documents', 'policies'] });
    },
    onError: (error: Error) => toast.error('No fue posible publicar', error.message),
  });

  const pending = (mine ?? []).filter((item) => !item.acknowledgedAt);

  const columns: Array<Column<PolicyRow>> = [
    {
      key: 'title',
      header: 'Politica',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.code}
            {row.category ? ` · ${row.category}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'currentVersion', header: 'Version', render: (row) => `v${row.currentVersion}` },
    {
      key: 'publishedAt',
      header: 'Publicada',
      hideOnMobile: true,
      render: (row) =>
        row.publishedAt ? formatDate(row.publishedAt) : <Badge tone="muted">Borrador</Badge>,
    },
    {
      key: 'acks',
      header: 'Acuses',
      hideOnMobile: true,
      render: (row) => (
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            setAuditing(row);
          }}
        >
          {row._count.acknowledgements}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        !row.publishedAt && can('documents.policy.publish') ? (
          <Button
            size="sm"
            loading={publish.isPending}
            onClick={(event) => {
              event.stopPropagation();
              publish.mutate(row);
            }}
          >
            <Send className="h-4 w-4" />
            Publicar
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Politicas y reglamentos"
        description="Versionadas, con acuse de lectura y firma simple con sello de tiempo."
        actions={
          can('documents.policy.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva politica
            </Button>
          ) : null
        }
      />

      {pending.length ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm">Pendientes de leer y aceptar</CardTitle>
            <CardDescription>Su acuse queda registrado con fecha, hora y version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border bg-background p-3"
              >
                <BookMarked className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.policy.title}</p>
                  <p className="text-xs text-muted-foreground">Version {item.version.version}</p>
                </div>
                <Button size="sm" onClick={() => setReading(item)}>
                  Leer y aceptar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (mine ?? []).length ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Esta al dia con todas las politicas asignadas.
          </CardContent>
        </Card>
      ) : null}

      {can('documents.policy.read') ? (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          total={data?.meta?.total ?? 0}
          page={page}
          limit={25}
          onPageChange={setPage}
          emptyTitle="Sin politicas publicadas"
        />
      ) : null}

      {creating ? <PolicyDialog open onOpenChange={() => setCreating(false)} /> : null}
      {reading ? (
        <ReadPolicyDialog open onOpenChange={() => setReading(null)} item={reading} />
      ) : null}
      {auditing ? (
        <AcknowledgementsDialog open onOpenChange={() => setAuditing(null)} policy={auditing} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    title: '',
    code: '',
    category: '',
    summary: '',
    requiresAck: true,
    requiresSignature: false,
    effectiveFrom: '',
  });
  const [blocks, setBlocks] = React.useState<BlockDocument>(EMPTY_DOCUMENT);

  const create = useMutation({
    mutationFn: () =>
      apiPost('/documents/policies', {
        ...form,
        category: form.category || null,
        summary: form.summary || null,
        effectiveFrom: form.effectiveFrom || null,
        blocks,
      }),
    onSuccess: () => {
      toast.success('Politica creada', 'Publiquela para solicitar los acuses.');
      void queryClient.invalidateQueries({ queryKey: ['documents', 'policies'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear la politica', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nueva politica</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titulo" required>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label="Codigo" required>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Categoria">
              <Input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Seguridad, convivencia, SST..."
              />
            </Field>
            <Field label="Vigente desde">
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Resumen">
            <Textarea
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              rows={2}
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.requiresAck}
                onCheckedChange={(checked) => setForm({ ...form, requiresAck: checked === true })}
              />
              Requiere acuse de lectura
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.requiresSignature}
                onCheckedChange={(checked) =>
                  setForm({ ...form, requiresSignature: checked === true })
                }
              />
              Requiere firma simple
            </label>
          </div>
          <div className="max-h-[45vh] overflow-y-auto rounded-md border p-2">
            <BlockEditor value={blocks} onChange={setBlocks} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.title.trim() || !form.code.trim() || !blocks.blocks.length}
            onClick={() => create.mutate()}
          >
            Crear politica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function ReadPolicyDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MyAcknowledgement;
}) {
  const queryClient = useQueryClient();
  const [readToEnd, setReadToEnd] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // The acknowledgement only unlocks once the whole text has been scrolled.
  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 24) setReadToEnd(true);
  };

  const acknowledge = useMutation({
    mutationFn: () =>
      apiPost(`/documents/policies/versions/${item.version.id}/acknowledge`, {
        sign: item.policy.requiresSignature,
      }),
    onSuccess: () => {
      toast.success('Acuse registrado', 'Se guardo la fecha, hora y version aceptada.');
      void queryClient.invalidateQueries({ queryKey: ['documents', 'policies'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar el acuse', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item.policy.title}</DialogTitle>
        </DialogHeader>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[55vh] overflow-y-auto rounded-md border p-4"
        >
          <BlockRenderer document={item.version.blocks} options={{ readOnly: true }} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={accepted}
            disabled={!readToEnd}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            className="mt-0.5"
          />
          <span className={readToEnd ? '' : 'text-muted-foreground'}>
            He leido y acepto esta politica en su version {item.version.version}
            {item.policy.requiresSignature ? ', y la firmo electronicamente' : ''}.
            {!readToEnd ? ' (desplace el texto hasta el final para habilitar)' : ''}
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            loading={acknowledge.isPending}
            disabled={!accepted}
            onClick={() => acknowledge.mutate()}
          >
            Aceptar politica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function AcknowledgementsDialog({
  open,
  onOpenChange,
  policy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: PolicyRow;
}) {
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'policies', policy.id, 'acks', page],
    queryFn: () =>
      apiList<{
        id: string;
        acknowledgedAt: string | null;
        signedAt: string | null;
        employee: { id: string; fullName: string; employeeCode: string };
      }>(`/documents/policies/${policy.id}/acknowledgements`, { page, limit: 25 }),
    retry: false,
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const done = rows.filter((row) => row.acknowledgedAt).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Acuses de «{policy.title}»</DialogTitle>
        </DialogHeader>
        {total ? (
          <div className="space-y-1">
            <Progress value={(done / Math.max(1, rows.length)) * 100} />
            <p className="text-xs text-muted-foreground">
              {formatPercent((done / Math.max(1, rows.length)) * 100, 0)} de la pagina actual con
              acuse registrado.
            </p>
          </div>
        ) : null}
        <DataTable
          columns={[
            {
              key: 'employee',
              header: 'Colaborador',
              render: (row: any) => row.employee?.fullName ?? '—',
            },
            {
              key: 'acknowledgedAt',
              header: 'Acuse',
              render: (row: any) =>
                row.acknowledgedAt ? (
                  formatDate(row.acknowledgedAt)
                ) : (
                  <Badge tone="warning">Pendiente</Badge>
                ),
            },
            {
              key: 'signedAt',
              header: 'Firma',
              hideOnMobile: true,
              render: (row: any) => (row.signedAt ? formatDate(row.signedAt) : '—'),
            },
          ]}
          rows={rows}
          loading={isLoading}
          total={total}
          page={page}
          limit={25}
          onPageChange={setPage}
          emptyTitle="Sin acuses registrados"
        />
        {!total && !isLoading ? (
          <EmptyState
            icon={BookMarked}
            title="Aun no se ha publicado"
            description="Publique la politica para solicitar acuses."
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
