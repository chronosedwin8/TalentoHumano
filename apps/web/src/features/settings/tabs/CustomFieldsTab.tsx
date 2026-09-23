import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Trash2 } from 'lucide-react';
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
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@/components/ui/overlays';

interface CustomField {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  options: Array<{ value: string; label: string }>;
  isRequired: boolean;
  isSensitive: boolean;
  employeeEditable: boolean;
  helpText: string | null;
  position: number;
  isActive: boolean;
}

const ENTITIES = [
  { value: 'employee', label: 'Colaborador' },
  { value: 'candidate', label: 'Candidato' },
  { value: 'asset', label: 'Activo' },
  { value: 'ticket', label: 'Ticket' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Texto corto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Lista desplegable' },
  { value: 'multiselect', label: 'Seleccion multiple' },
  { value: 'boolean', label: 'Si / No' },
  { value: 'file', label: 'Archivo' },
];

export function CustomFieldsTab() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = React.useState('employee');
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<CustomField | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'custom-fields', entityType],
    queryFn: () => apiGet<CustomField[]>('/settings/custom-fields', { entityType }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['settings', 'custom-fields', entityType] });

  const toggle = useMutation({
    mutationFn: (field: CustomField) =>
      apiPatch(`/settings/custom-fields/${field.id}`, { isActive: !field.isActive }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error('No fue posible actualizar', error.message),
  });

  const remove = useMutation({
    mutationFn: (field: CustomField) => apiDelete(`/settings/custom-fields/${field.id}`),
    onSuccess: () => {
      toast.success('Campo eliminado');
      void invalidate();
      setRemoving(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Campos personalizados</CardTitle>
            <CardDescription>
              Amplian la ficha sin migraciones. Los marcados como sensibles se cifran y su lectura
              se registra.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <NativeSelect
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="w-48"
            >
              {ENTITIES.map((entity) => (
                <option key={entity.value} value={entity.value}>
                  {entity.label}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nuevo campo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay campos personalizados para esta entidad.
          </p>
        ) : (
          data?.map((field) => (
            <div
              key={field.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {field.label}
                  {field.isRequired ? <span className="ml-0.5 text-destructive">*</span> : null}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{field.key}</p>
              </div>
              <Badge tone="muted">
                {FIELD_TYPES.find((type) => type.value === field.fieldType)?.label ??
                  field.fieldType}
              </Badge>
              {field.isSensitive ? (
                <Badge tone="warning">
                  <Lock className="mr-1 inline h-3 w-3" />
                  Sensible
                </Badge>
              ) : null}
              {field.employeeEditable ? (
                <Badge tone="info">Editable por el colaborador</Badge>
              ) : null}
              <Switch checked={field.isActive} onCheckedChange={() => toggle.mutate(field)} />
              <Button size="sm" variant="ghost" onClick={() => setRemoving(field)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      {creating ? (
        <FieldDialog
          open
          onOpenChange={() => setCreating(false)}
          entityType={entityType}
          position={(data?.length ?? 0) + 1}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar campo"
        description={`Se eliminara «${removing?.label ?? ''}» y los valores capturados dejaran de mostrarse.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function FieldDialog({
  open,
  onOpenChange,
  entityType,
  position,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  position: number;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    label: '',
    key: '',
    fieldType: 'text',
    isRequired: false,
    isSensitive: false,
    employeeEditable: false,
    helpText: '',
  });
  const [options, setOptions] = React.useState('');

  const needsOptions = form.fieldType === 'select' || form.fieldType === 'multiselect';

  const create = useMutation({
    mutationFn: () =>
      apiPost('/settings/custom-fields', {
        entityType,
        key: form.key,
        label: form.label,
        fieldType: form.fieldType,
        options: needsOptions
          ? options
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [value, label] = line.split('|').map((part) => part.trim());
                return { value: value ?? line, label: label ?? value ?? line };
              })
          : [],
        isRequired: form.isRequired,
        isSensitive: form.isSensitive,
        employeeEditable: form.employeeEditable,
        helpText: form.helpText || null,
        position,
      }),
    onSuccess: () => {
      toast.success('Campo creado');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'custom-fields'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear el campo', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo campo personalizado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Etiqueta" required>
              <Input
                value={form.label}
                onChange={(event) => {
                  const label = event.target.value;
                  setForm((current) => ({
                    ...current,
                    label,
                    // Derives a valid key from the label until it is edited by hand.
                    key:
                      current.key && current.key !== slugKey(current.label)
                        ? current.key
                        : slugKey(label),
                  }));
                }}
              />
            </Field>
            <Field label="Clave" required hint="Minusculas, numeros y guion bajo">
              <Input
                value={form.key}
                onChange={(event) => setForm({ ...form, key: slugKey(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Tipo">
            <NativeSelect
              value={form.fieldType}
              onChange={(event) => setForm({ ...form, fieldType: event.target.value })}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {needsOptions ? (
            <Field
              label="Opciones"
              hint="Una por linea. Use «valor | etiqueta» para diferenciarlos"
            >
              <textarea
                value={options}
                onChange={(event) => setOptions(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          ) : null}
          <Field label="Texto de ayuda">
            <Input
              value={form.helpText}
              onChange={(event) => setForm({ ...form, helpText: event.target.value })}
            />
          </Field>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.isRequired}
                onCheckedChange={(checked) => setForm({ ...form, isRequired: checked === true })}
              />
              Obligatorio
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.isSensitive}
                onCheckedChange={(checked) => setForm({ ...form, isSensitive: checked === true })}
              />
              Dato sensible (se cifra y su lectura se registra)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.employeeEditable}
                onCheckedChange={(checked) =>
                  setForm({ ...form, employeeEditable: checked === true })
                }
              />
              El colaborador puede editarlo desde su portal
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.label.trim() || !/^[a-z][a-z0-9_]{1,59}$/.test(form.key)}
            onClick={() => create.mutate()}
          >
            Crear campo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function slugKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
