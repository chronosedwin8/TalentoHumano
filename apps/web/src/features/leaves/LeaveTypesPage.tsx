import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@/components/ui/overlays';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  color: string;
  requiresApproval: boolean;
  requiresAttachment: boolean;
  affectsBalance: boolean;
  countsBusinessDays: boolean;
  maxDaysPerRequest: number | null;
  minNoticeDays: number;
  isPaid: boolean;
  requiresCoverage: boolean;
  isActive: boolean;
  description: string | null;
}

interface LeavePolicy {
  id: string;
  name: string;
  daysPerYear: string | number;
  accrualMode: string;
  countsBusinessDays: boolean;
  maxCarryOverDays: string | number | null;
  alertThresholdDays: number;
  minDaysPerRequest: number;
  isDefault: boolean;
}

const EMPTY_TYPE = {
  name: '',
  code: '',
  color: '#2563eb',
  requiresApproval: true,
  requiresAttachment: false,
  affectsBalance: false,
  countsBusinessDays: true,
  maxDaysPerRequest: '',
  minNoticeDays: '0',
  isPaid: true,
  requiresCoverage: false,
  isActive: true,
  description: '',
};

type TypeForm = typeof EMPTY_TYPE;

/** Administration of leave types and vacation policies (days only, never money). */
export function LeaveTypesPage() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<LeaveType | null | 'new'>(null);
  const [removing, setRemoving] = React.useState<LeaveType | null>(null);
  const [policyOpen, setPolicyOpen] = React.useState(false);

  const { data: types, isLoading } = useQuery({
    queryKey: ['leaves', 'types'],
    queryFn: () => apiGet<LeaveType[]>('/leaves/types'),
  });
  const { data: policies } = useQuery({
    queryKey: ['leaves', 'policies'],
    queryFn: () => apiGet<LeavePolicy[]>('/leaves/policies'),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/leaves/types/${id}`),
    onSuccess: () => {
      toast.success('Tipo eliminado');
      void queryClient.invalidateQueries({ queryKey: ['leaves', 'types'] });
      setRemoving(null);
    },
    onError: (error: Error) => toast.error('No fue posible eliminar', error.message),
  });

  const manage = can('leaves.type.manage');

  const columns: Array<Column<LeaveType>> = [
    {
      key: 'name',
      header: 'Tipo',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
            aria-hidden
          />
          <span className="font-medium">{row.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
        </span>
      ),
    },
    {
      key: 'rules',
      header: 'Reglas',
      hideOnMobile: true,
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.requiresApproval ? <Badge tone="muted">Con aprobacion</Badge> : null}
          {row.affectsBalance ? <Badge tone="info">Descuenta saldo</Badge> : null}
          {row.requiresAttachment ? <Badge tone="muted">Adjunto obligatorio</Badge> : null}
          {row.requiresCoverage ? <Badge tone="muted">Requiere reemplazo</Badge> : null}
          {!row.isPaid ? <Badge tone="warning">No remunerada</Badge> : null}
        </span>
      ),
    },
    {
      key: 'limits',
      header: 'Limites',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.maxDaysPerRequest ? `Max. ${row.maxDaysPerRequest} dias` : 'Sin maximo'} ·{' '}
          {row.minNoticeDays ? `${row.minNoticeDays} dias de aviso` : 'Sin aviso minimo'} ·{' '}
          {row.countsBusinessDays ? 'dias habiles' : 'dias calendario'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) =>
        row.isActive ? <Badge tone="success">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        manage ? (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(row);
              }}
              aria-label={`Editar ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setRemoving(row);
              }}
              aria-label={`Eliminar ${row.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos de ausencia y politicas"
        description="Que se puede solicitar, con que reglas y cuantos dias de vacaciones se devengan al ano."
        actions={
          manage ? (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              Nuevo tipo
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        rows={types ?? []}
        loading={isLoading}
        total={types?.length ?? 0}
        limit={200}
        emptyTitle="Sin tipos de ausencia"
        emptyDescription="Cree el primero para que los colaboradores puedan solicitar."
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Politicas de vacaciones</CardTitle>
            <CardDescription>
              Dias por ano y reglas de devengo. La plataforma nunca valora los dias en dinero.
            </CardDescription>
          </div>
          {can('leaves.policy.manage') ? (
            <Button variant="outline" onClick={() => setPolicyOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva politica
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {(policies ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin politicas propias: aplica la ley colombiana (15 dias habiles por ano).
            </p>
          ) : (
            <ul className="divide-y">
              {(policies ?? []).map((policy) => (
                <li key={policy.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="font-medium">{policy.name}</span>
                  {policy.isDefault ? <Badge tone="info">Por defecto</Badge> : null}
                  <span className="text-muted-foreground">
                    {Number(policy.daysPerYear)} dias/ano · devengo{' '}
                    {policy.accrualMode === 'monthly'
                      ? 'mensual'
                      : policy.accrualMode === 'daily'
                        ? 'diario'
                        : 'anual'}{' '}
                    · {policy.countsBusinessDays ? 'habiles' : 'calendario'}
                    {policy.maxCarryOverDays !== null && policy.maxCarryOverDays !== undefined
                      ? ` · acumula hasta ${Number(policy.maxCarryOverDays)} dias`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <TypeDialog
          open
          type={editing === 'new' ? null : editing}
          onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title="Eliminar tipo de ausencia"
        description={`Las solicitudes existentes de "${removing?.name ?? ''}" se conservan; solo deja de ofrecerse.`}
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => (removing ? remove.mutate(removing.id) : undefined)}
      />

      <PolicyDialog open={policyOpen} onOpenChange={setPolicyOpen} />
    </div>
  );
}

function TypeDialog({
  open,
  onOpenChange,
  type,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: LeaveType | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TypeForm>(() =>
    type
      ? {
          name: type.name,
          code: type.code,
          color: type.color,
          requiresApproval: type.requiresApproval,
          requiresAttachment: type.requiresAttachment,
          affectsBalance: type.affectsBalance,
          countsBusinessDays: type.countsBusinessDays,
          maxDaysPerRequest: type.maxDaysPerRequest ? String(type.maxDaysPerRequest) : '',
          minNoticeDays: String(type.minNoticeDays ?? 0),
          isPaid: type.isPaid,
          requiresCoverage: type.requiresCoverage,
          isActive: type.isActive,
          description: type.description ?? '',
        }
      : EMPTY_TYPE,
  );

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        code: form.code,
        color: form.color,
        requiresApproval: form.requiresApproval,
        requiresAttachment: form.requiresAttachment,
        affectsBalance: form.affectsBalance,
        countsBusinessDays: form.countsBusinessDays,
        maxDaysPerRequest: form.maxDaysPerRequest ? Number(form.maxDaysPerRequest) : null,
        minNoticeDays: Number(form.minNoticeDays || 0),
        isPaid: form.isPaid,
        requiresCoverage: form.requiresCoverage,
        isActive: form.isActive,
        description: form.description || null,
      };
      return type
        ? apiPatch(`/leaves/types/${type.id}`, payload)
        : apiPost('/leaves/types', payload);
    },
    onSuccess: () => {
      toast.success(type ? 'Tipo actualizado' : 'Tipo creado');
      void queryClient.invalidateQueries({ queryKey: ['leaves', 'types'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  const flag = (key: keyof TypeForm, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={Boolean(form[key])}
        onCheckedChange={(checked) => setForm({ ...form, [key]: checked === true })}
      />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{type ? 'Editar tipo de ausencia' : 'Nuevo tipo de ausencia'}</DialogTitle>
          <DialogDescription>
            El codigo se usa en integraciones y en la exportacion a nomina.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_90px]">
            <Field label="Nombre" required>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Codigo" required>
              <Input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toLowerCase().replace(/\s+/g, '_') })
                }
                disabled={Boolean(type)}
              />
            </Field>
            <Field label="Color">
              <Input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Maximo de dias por solicitud" hint="Vacio: sin limite">
              <Input
                type="number"
                min={1}
                max={365}
                value={form.maxDaysPerRequest}
                onChange={(event) => setForm({ ...form, maxDaysPerRequest: event.target.value })}
              />
            </Field>
            <Field label="Dias minimos de anticipacion">
              <Input
                type="number"
                min={0}
                max={365}
                value={form.minNoticeDays}
                onChange={(event) => setForm({ ...form, minNoticeDays: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {flag('requiresApproval', 'Requiere aprobacion')}
            {flag('affectsBalance', 'Descuenta del saldo de vacaciones')}
            {flag('requiresAttachment', 'Exige adjunto (incapacidad, certificado)')}
            {flag('requiresCoverage', 'Exige persona de reemplazo')}
            {flag('countsBusinessDays', 'Cuenta dias habiles')}
            {flag('isPaid', 'Remunerada')}
            {flag('isActive', 'Activo')}
          </div>
          <Field label="Descripcion">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={save.isPending}
            disabled={form.name.trim().length < 2 || form.code.trim().length < 2}
            onClick={() => save.mutate()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: '',
    daysPerYear: '15',
    accrualMode: 'monthly',
    countsBusinessDays: true,
    maxCarryOverDays: '',
    alertThresholdDays: '30',
    minDaysPerRequest: '1',
    isDefault: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/leaves/policies', {
        name: form.name,
        daysPerYear: Number(form.daysPerYear),
        accrualMode: form.accrualMode,
        countsBusinessDays: form.countsBusinessDays,
        maxCarryOverDays: form.maxCarryOverDays ? Number(form.maxCarryOverDays) : null,
        alertThresholdDays: Number(form.alertThresholdDays || 30),
        minDaysPerRequest: Number(form.minDaysPerRequest || 1),
        isDefault: form.isDefault,
      }),
    onSuccess: () => {
      toast.success('Politica creada');
      void queryClient.invalidateQueries({ queryKey: ['leaves', 'policies'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva politica de vacaciones</DialogTitle>
          <DialogDescription>Solo dias. La liquidacion es de la nomina externa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nombre" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dias por ano" required>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.daysPerYear}
                onChange={(event) => setForm({ ...form, daysPerYear: event.target.value })}
              />
            </Field>
            <Field label="Devengo">
              <NativeSelect
                value={form.accrualMode}
                onChange={(event) => setForm({ ...form, accrualMode: event.target.value })}
              >
                <option value="monthly">Mensual</option>
                <option value="daily">Diario</option>
                <option value="yearly">Anual</option>
              </NativeSelect>
            </Field>
            <Field label="Maximo acumulable" hint="Vacio: sin tope">
              <Input
                type="number"
                min={0}
                max={120}
                value={form.maxCarryOverDays}
                onChange={(event) => setForm({ ...form, maxCarryOverDays: event.target.value })}
              />
            </Field>
            <Field label="Alerta al acumular (dias)">
              <Input
                type="number"
                min={0}
                max={120}
                value={form.alertThresholdDays}
                onChange={(event) => setForm({ ...form, alertThresholdDays: event.target.value })}
              />
            </Field>
            <Field label="Minimo de dias por solicitud">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.minDaysPerRequest}
                onChange={(event) => setForm({ ...form, minDaysPerRequest: event.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.countsBusinessDays}
              onCheckedChange={(checked) =>
                setForm({ ...form, countsBusinessDays: checked === true })
              }
            />
            Cuenta dias habiles
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isDefault}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked === true })}
            />
            Politica por defecto de la empresa
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
