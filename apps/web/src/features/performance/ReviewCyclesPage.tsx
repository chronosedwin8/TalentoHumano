import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid3x3, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiList, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
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
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface CycleRow {
  id: string;
  name: string;
  type: string;
  status: string;
  selfStart: string | null;
  selfEnd: string | null;
  evalStart: string | null;
  evalEnd: string | null;
  calibrationDate: string | null;
  anonymousPeers: boolean;
  _count: { assignments: number };
}

const TYPE_LABELS: Record<string, string> = {
  ninety: '90 grados (auto + jefe)',
  one_eighty: '180 grados (+ pares)',
  three_sixty: '360 grados (+ reportes)',
};

const STAGES = [
  { value: 'draft', label: 'Borrador' },
  { value: 'self_assessment', label: 'Autoevaluacion' },
  { value: 'evaluation', label: 'Evaluacion' },
  { value: 'calibration', label: 'Calibracion' },
  { value: 'feedback_meeting', label: 'Reunion de feedback' },
  { value: 'closed', label: 'Cerrado' },
];

export function ReviewCyclesPage() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'cycles'],
    queryFn: () => apiList<CycleRow>('/performance/cycles', { limit: 25 }),
  });

  const generate = useMutation({
    mutationFn: (cycleId: string) =>
      apiPost(`/performance/cycles/${cycleId}/generate-assignments`, { peersPerEmployee: 3 }),
    onSuccess: (result: any) => {
      toast.success('Evaluadores generados', `${result.assignments} asignaciones creadas.`);
      void queryClient.invalidateQueries({ queryKey: ['performance', 'cycles'] });
    },
    onError: (error: Error) => toast.error('No fue posible generar', error.message),
  });

  const changeStage = useMutation({
    mutationFn: ({ cycleId, status }: { cycleId: string; status: string }) =>
      apiPatch(`/performance/cycles/${cycleId}/status`, { status }),
    onSuccess: () => {
      toast.success('Etapa actualizada');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'cycles'] });
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ciclos de evaluacion"
        description="Evaluaciones 90, 180 y 360 grados con calibracion y matriz 9-box."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/performance/mis-evaluaciones">Mis evaluaciones</Link>
            </Button>
            {can('performance.cycle.create') ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo ciclo
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin ciclos de evaluacion"
          description="Cree el primer ciclo del periodo."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((cycle) => (
            <Card key={cycle.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{cycle.name}</CardTitle>
                    <CardDescription>{TYPE_LABELS[cycle.type] ?? cycle.type}</CardDescription>
                  </div>
                  <Badge tone={statusTone(cycle.status)}>{statusLabel(cycle.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Autoevaluacion</dt>
                    <dd>
                      {formatDate(cycle.selfStart)} — {formatDate(cycle.selfEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Evaluacion</dt>
                    <dd>
                      {formatDate(cycle.evalStart)} — {formatDate(cycle.evalEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Calibracion</dt>
                    <dd>{formatDate(cycle.calibrationDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Evaluaciones</dt>
                    <dd>{cycle._count.assignments}</dd>
                  </div>
                </dl>

                {cycle.anonymousPeers ? (
                  <p className="text-xs text-muted-foreground">
                    Las respuestas de pares y reportes son anonimas.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {can('performance.cycle.update') ? (
                    <>
                      <NativeSelect
                        value={cycle.status}
                        onChange={(event) =>
                          changeStage.mutate({ cycleId: cycle.id, status: event.target.value })
                        }
                        className="w-48"
                      >
                        {STAGES.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={generate.isPending}
                        onClick={() => generate.mutate(cycle.id)}
                      >
                        <Users className="h-4 w-4" />
                        Generar evaluadores
                      </Button>
                    </>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/performance/nine-box/${cycle.id}`}>
                      <Grid3x3 className="h-4 w-4" />
                      9-box
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCycleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateCycleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: '',
    type: 'three_sixty',
    selfStart: '',
    selfEnd: '',
    evalStart: '',
    evalEnd: '',
    calibrationDate: '',
    instructions: '',
    anonymousPeers: true,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/performance/cycles', {
        ...form,
        selfStart: form.selfStart || null,
        selfEnd: form.selfEnd || null,
        evalStart: form.evalStart || null,
        evalEnd: form.evalEnd || null,
        calibrationDate: form.calibrationDate || null,
        instructions: form.instructions || null,
      }),
    onSuccess: () => {
      toast.success('Ciclo creado');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'cycles'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear el ciclo', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nuevo ciclo de evaluacion</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Tipo" className="sm:col-span-2">
            <NativeSelect
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              <option value="ninety">90 grados (autoevaluacion + jefe)</option>
              <option value="one_eighty">180 grados (+ pares)</option>
              <option value="three_sixty">360 grados (+ reportes directos)</option>
            </NativeSelect>
          </Field>
          <Field label="Autoevaluacion desde">
            <Input
              type="date"
              value={form.selfStart}
              onChange={(event) => setForm({ ...form, selfStart: event.target.value })}
            />
          </Field>
          <Field label="Autoevaluacion hasta">
            <Input
              type="date"
              value={form.selfEnd}
              onChange={(event) => setForm({ ...form, selfEnd: event.target.value })}
            />
          </Field>
          <Field label="Evaluacion desde">
            <Input
              type="date"
              value={form.evalStart}
              onChange={(event) => setForm({ ...form, evalStart: event.target.value })}
            />
          </Field>
          <Field label="Evaluacion hasta">
            <Input
              type="date"
              value={form.evalEnd}
              onChange={(event) => setForm({ ...form, evalEnd: event.target.value })}
            />
          </Field>
          <Field label="Fecha de calibracion">
            <Input
              type="date"
              value={form.calibrationDate}
              onChange={(event) => setForm({ ...form, calibrationDate: event.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.anonymousPeers}
              onChange={(event) => setForm({ ...form, anonymousPeers: event.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Respuestas de pares anonimas
          </label>
          <Field label="Instrucciones" className="sm:col-span-2">
            <Textarea
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              rows={3}
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
            Crear ciclo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
