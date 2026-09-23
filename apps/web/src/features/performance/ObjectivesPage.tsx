import { objectiveSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Target, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatPercent, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface KeyResult {
  id: string;
  title: string;
  metric: string | null;
  startValue: string;
  targetValue: string;
  currentValue: string;
  confidence: string;
}

interface ObjectiveRow {
  id: string;
  title: string;
  description: string | null;
  level: string;
  status: string;
  progress: string;
  dueDate: string | null;
  keyResults: KeyResult[];
  owner: { id: string; fullName: string } | null;
}

export function ObjectivesPage() {
  const can = useAuth((state) => state.can);
  const [cycleId, setCycleId] = React.useState('');
  const [level, setLevel] = React.useState('');
  const [page] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: cycles } = useQuery({
    queryKey: ['performance', 'objective-cycles'],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; status: string }>>('/performance/objective-cycles'),
    retry: false,
  });

  React.useEffect(() => {
    if (!cycleId && cycles?.length) setCycleId(cycles[0].id);
  }, [cycles, cycleId]);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'objectives', { cycleId, level, page }],
    queryFn: () =>
      apiList<ObjectiveRow>('/performance/objectives', { cycleId, level, page, limit: 50 }),
    enabled: Boolean(cycleId),
  });

  const { data: metrics } = useQuery({
    queryKey: ['performance', 'metrics'],
    queryFn: () =>
      apiGet<{
        activeObjectives: number;
        averageProgress: number;
        activeCycles: number;
        reviewCompletion: number;
        activeDevelopmentPlans: number;
      }>('/performance/metrics'),
    retry: false,
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objetivos y OKR"
        description="Arbol de objetivos de empresa, area y persona con resultados clave medibles."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/performance/ciclos">Ciclos de evaluacion</Link>
            </Button>
            {can('performance.objective.create') ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo objetivo
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Objetivos activos" value={metrics?.activeObjectives ?? 0} icon={Target} />
        <StatCard
          label="Avance promedio"
          value={formatPercent(metrics?.averageProgress ?? 0)}
          icon={TrendingUp}
        />
        <StatCard label="Ciclos en curso" value={metrics?.activeCycles ?? 0} />
        <StatCard label="Planes de desarrollo" value={metrics?.activeDevelopmentPlans ?? 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <NativeSelect
          value={cycleId}
          onChange={(event) => setCycleId(event.target.value)}
          className="w-56"
        >
          {(cycles ?? []).map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="w-48"
        >
          <option value="">Todos los niveles</option>
          <option value="company">Empresa</option>
          <option value="department">Area</option>
          <option value="individual">Individual</option>
        </NativeSelect>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin objetivos"
          description="Cree el primer objetivo del ciclo."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((objective) => (
            <ObjectiveCard key={objective.id} objective={objective} />
          ))}
        </div>
      )}

      <CreateObjectiveDialog open={createOpen} onOpenChange={setCreateOpen} cycleId={cycleId} />
    </div>
  );
}

function ObjectiveCard({ objective }: { objective: ObjectiveRow }) {
  const [open, setOpen] = React.useState(false);
  const [checkin, setCheckin] = React.useState<KeyResult | null>(null);

  const progress = Number(objective.progress);

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start gap-3 text-left"
        >
          {open ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{objective.title}</p>
              <Badge tone="muted">{statusLabel(objective.level)}</Badge>
              <Badge tone={statusTone(objective.status)}>{statusLabel(objective.status)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {objective.owner?.fullName ?? 'Sin responsable'}
              {objective.dueDate ? ` · vence ${formatDate(objective.dueDate)}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Progress
                value={progress}
                className="max-w-sm"
                tone={progress >= 80 ? 'success' : progress >= 40 ? 'default' : 'warning'}
              />
              <span className="text-sm font-medium tabular-nums">{Math.round(progress)}%</span>
            </div>
          </div>
        </button>

        {open ? (
          <div className="mt-3 space-y-2 border-t pt-3">
            {objective.description ? (
              <p className="text-sm text-muted-foreground">{objective.description}</p>
            ) : null}
            {objective.keyResults.map((keyResult) => {
              const start = Number(keyResult.startValue);
              const target = Number(keyResult.targetValue);
              const current = Number(keyResult.currentValue);
              const ratio = target === start ? 0 : ((current - start) / (target - start)) * 100;
              return (
                <div
                  key={keyResult.id}
                  className="flex items-center gap-3 rounded-md border p-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{keyResult.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {current} de {target} {keyResult.metric ?? ''}
                    </p>
                  </div>
                  <Badge tone={statusTone(keyResult.confidence)}>
                    {statusLabel(keyResult.confidence)}
                  </Badge>
                  <span className="w-12 text-right text-xs tabular-nums">
                    {Math.round(Math.max(0, Math.min(100, ratio)))}%
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCheckin(keyResult)}>
                    Check-in
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>

      <CheckinDialog keyResult={checkin} onClose={() => setCheckin(null)} />
    </Card>
  );
}

function CheckinDialog({
  keyResult,
  onClose,
}: {
  keyResult: KeyResult | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState('');
  const [confidence, setConfidence] = React.useState('on_track');
  const [comment, setComment] = React.useState('');

  React.useEffect(() => {
    if (keyResult) setValue(String(Number(keyResult.currentValue)));
  }, [keyResult]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost('/performance/checkins', {
        keyResultId: keyResult?.id,
        value: Number(value),
        confidence,
        comment: comment || null,
      }),
    onSuccess: () => {
      toast.success('Check-in registrado');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'objectives'] });
      onClose();
      setComment('');
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <Dialog open={Boolean(keyResult)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Check-in del resultado clave</DialogTitle>
          <DialogDescription>{keyResult?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Valor actual" required>
            <Input type="number" value={value} onChange={(event) => setValue(event.target.value)} />
          </Field>
          <Field label="Confianza">
            <NativeSelect
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
            >
              <option value="on_track">En curso</option>
              <option value="at_risk">En riesgo</option>
              <option value="off_track">Desviado</option>
            </NativeSelect>
          </Field>
          <Field label="Comentario">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateObjectiveDialog({
  open,
  onOpenChange,
  cycleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    level: 'individual',
    dueDate: '',
  });
  const [keyResults, setKeyResults] = React.useState([
    {
      title: '',
      metric: 'porcentaje',
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      weight: 100,
    },
  ]);

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost('/performance/objectives', payload),
    onSuccess: () => {
      toast.success('Objetivo creado');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'objectives'] });
      onOpenChange(false);
      setForm({ title: '', description: '', level: 'individual', dueDate: '' });
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nuevo objetivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo" required>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nivel">
              <NativeSelect
                value={form.level}
                onChange={(event) => setForm({ ...form, level: event.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="team">Equipo</option>
                <option value="department">Area</option>
                <option value="company">Empresa</option>
              </NativeSelect>
            </Field>
            <Field label="Fecha limite">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Descripcion">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={2}
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">Resultados clave</p>
            {keyResults.map((keyResult, index) => (
              <div key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-6"
                  value={keyResult.title}
                  onChange={(event) =>
                    setKeyResults((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Resultado medible"
                />
                <Input
                  className="sm:col-span-3"
                  value={keyResult.metric}
                  onChange={(event) =>
                    setKeyResults((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, metric: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Metrica"
                />
                <Input
                  className="sm:col-span-3"
                  type="number"
                  value={keyResult.targetValue}
                  onChange={(event) =>
                    setKeyResults((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, targetValue: Number(event.target.value) } : item,
                      ),
                    )
                  }
                  placeholder="Meta"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setKeyResults((current) => [
                  ...current,
                  {
                    title: '',
                    metric: 'porcentaje',
                    startValue: 0,
                    targetValue: 100,
                    currentValue: 0,
                    weight: 100,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Agregar resultado clave
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              setError(null);
              const payload = {
                cycleId,
                title: form.title,
                description: form.description || null,
                level: form.level,
                ownerEmployeeId: form.level === 'individual' ? user?.employee?.id : null,
                dueDate: form.dueDate || null,
                keyResults: keyResults.filter((keyResult) => keyResult.title.trim()),
              };
              const parsed = objectiveSchema.safeParse(payload);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              create.mutate(parsed.data);
            }}
          >
            Crear objetivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
