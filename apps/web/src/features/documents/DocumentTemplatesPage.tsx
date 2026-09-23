import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { apiGet, apiList, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel } from '@/lib/utils';
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
  PageHeader,
} from '@/components/ui/primitives';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface TemplateRow {
  id: string;
  name: string;
  code: string;
  kind: string;
  description: string | null;
  blocks: BlockDocument | null;
  variables: string[];
  isSelfService: boolean;
  requiresSignature: boolean;
  isActive: boolean;
  createdAt: string;
}

interface VariableRow {
  variable: string;
  path: string;
}

const KINDS = [
  { value: 'letter', label: 'Carta' },
  { value: 'certificate', label: 'Certificado' },
  { value: 'act', label: 'Acta' },
  { value: 'contract', label: 'Contrato' },
  { value: 'memo', label: 'Memorando' },
];

export function DocumentTemplatesPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<TemplateRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [generateFor, setGenerateFor] = React.useState<TemplateRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'templates', page],
    queryFn: () => apiList<TemplateRow>('/documents/templates', { page, limit: 25 }),
  });

  const columns: Array<Column<TemplateRow>> = [
    {
      key: 'name',
      header: 'Plantilla',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: (row) => (
        <Badge tone="muted">{KINDS.find((k) => k.value === row.kind)?.label ?? row.kind}</Badge>
      ),
    },
    {
      key: 'isSelfService',
      header: 'Autoservicio',
      hideOnMobile: true,
      render: (row) =>
        row.isSelfService ? (
          <Badge tone="success">Habilitado</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'requiresSignature',
      header: 'Firma',
      hideOnMobile: true,
      render: (row) => (row.requiresSignature ? 'Requiere firma' : '—'),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'muted'}>
          {row.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Creada',
      hideOnMobile: true,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        can('documents.generated.create') ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              setGenerateFor(row);
            }}
          >
            <Users className="h-4 w-4" />
            Generar
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de documentos"
        description="Cartas, certificados y actas con variables que se completan desde la hoja de vida."
        actions={
          can('documents.template.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva plantilla
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
        onRowClick={can('documents.template.update') ? (row) => setEditing(row) : undefined}
        emptyTitle="Sin plantillas"
        emptyDescription="Cree una plantilla para generar certificados laborales y cartas."
      />

      {creating ? <TemplateDialog open onOpenChange={() => setCreating(false)} /> : null}
      {editing ? (
        <TemplateDialog open onOpenChange={() => setEditing(null)} template={editing} />
      ) : null}
      {generateFor ? (
        <GenerateDialog open onOpenChange={() => setGenerateFor(null)} template={generateFor} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TemplateRow;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: template?.name ?? '',
    code: template?.code ?? '',
    kind: template?.kind ?? 'certificate',
    description: template?.description ?? '',
    isSelfService: template?.isSelfService ?? false,
    requiresSignature: template?.requiresSignature ?? false,
    isActive: template?.isActive ?? true,
  });
  const [blocks, setBlocks] = React.useState<BlockDocument>(template?.blocks ?? EMPTY_DOCUMENT);

  const { data: variables } = useQuery({
    queryKey: ['documents', 'variables'],
    queryFn: () => apiGet<VariableRow[]>('/documents/templates/variables'),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        description: form.description || null,
        blocks,
        // The variables actually used are what the body references.
        variables: (variables ?? [])
          .filter((variable) => JSON.stringify(blocks).includes(variable.variable))
          .map((variable) => variable.path),
      };
      return template
        ? apiPatch(`/documents/templates/${template.id}`, body)
        : apiPost('/documents/templates', body);
    },
    onSuccess: () => {
      toast.success(template ? 'Plantilla actualizada' : 'Plantilla creada');
      void queryClient.invalidateQueries({ queryKey: ['documents', 'templates'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" required>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Codigo" required hint="Identificador interno, sin espacios">
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Tipo">
                <NativeSelect
                  value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value })}
                >
                  {KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Descripcion">
                <Input
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.isSelfService}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isSelfService: checked === true })
                  }
                />
                El colaborador puede generarlo solo
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.requiresSignature}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, requiresSignature: checked === true })
                  }
                />
                Requiere firma
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                />
                Activa
              </label>
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-md border p-2">
              <BlockEditor value={blocks} onChange={setBlocks} />
            </div>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Variables disponibles</CardTitle>
              <CardDescription>Copie y pegue dentro del contenido.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[60vh] space-y-1 overflow-y-auto">
              {(variables ?? []).map((variable) => (
                <button
                  key={variable.path}
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(variable.variable);
                    toast.success('Variable copiada', variable.variable);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left font-mono text-xs hover:bg-accent"
                >
                  <span className="truncate">{variable.variable}</span>
                  <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={save.isPending}
            disabled={!form.name.trim() || !form.code.trim()}
            onClick={() => save.mutate()}
          >
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function GenerateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateRow;
}) {
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);

  const { data: employees } = useQuery({
    queryKey: ['people', 'picker', search],
    queryFn: () =>
      apiList<{
        id: string;
        fullName: string;
        employeeCode: string;
        position: { id: string; name: string } | null;
      }>('/people/employees', {
        search,
        limit: 20,
        status: 'active',
      }),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiPost<{ generated: number; documents: Array<{ documentId: string; code: string }> }>(
        '/documents/generate/bulk',
        { templateId: template.id, employeeIds: selected },
      ),
    onSuccess: (result) => {
      toast.success(
        `${result.generated} documentos generados`,
        'Consultelos en documentos generados.',
      );
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible generar', error.message),
  });

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar «{template.name}»</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar colaborador por nombre o documento"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
            {(employees?.data ?? []).map((employee) => (
              <label
                key={employee.id}
                className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(employee.id)}
                  onCheckedChange={() => toggle(employee.id)}
                />
                <span className="min-w-0 flex-1 truncate">
                  {employee.fullName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {employee.position?.name ?? ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selected.length} seleccionados</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={generate.isPending}
            disabled={!selected.length}
            onClick={() => generate.mutate()}
          >
            <FileText className="h-4 w-4" />
            Generar {selected.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kept so `statusLabel` stays imported where kinds fall outside the catalog. */
export const templateKindLabel = (kind: string): string =>
  KINDS.find((item) => item.value === kind)?.label ?? statusLabel(kind);
