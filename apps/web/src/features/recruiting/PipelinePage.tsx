import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { hireCandidateSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, UserCheck, XCircle } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Card,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface StageColumn {
  stage: { id: string; name: string; code: string; color: string; kind: string; position: number };
  applications: Array<{
    id: string;
    status: string;
    source: string;
    appliedAt: string;
    candidate: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      city: string | null;
      rating: number | null;
    };
    interviews: Array<{ id: string; scheduledAt: string; status: string }>;
  }>;
}

export function PipelinePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);

  const [hiring, setHiring] = React.useState<StageColumn['applications'][number] | null>(null);
  const [rejecting, setRejecting] = React.useState<StageColumn['applications'][number] | null>(
    null,
  );

  const { data: job } = useQuery({
    queryKey: ['recruiting', 'job', id],
    queryFn: () => apiGet<any>(`/recruiting/jobs/${id}`),
    enabled: Boolean(id),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'pipeline', id],
    queryFn: () => apiGet<StageColumn[]>(`/recruiting/jobs/${id}/pipeline`),
    enabled: Boolean(id),
  });

  const move = useMutation({
    mutationFn: ({ applicationId, stageId }: { applicationId: string; stageId: string }) =>
      apiPost(`/recruiting/applications/${applicationId}/move`, {
        stageId,
        notifyCandidate: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'pipeline', id] });
    },
    onError: (error: Error) => toast.error('No fue posible mover la postulacion', error.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const applicationId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : null;
    if (!stageId) return;
    const currentStage = (data ?? []).find((column) =>
      column.applications.some((application) => application.id === applicationId),
    );
    if (currentStage?.stage.id === stageId) return;
    move.mutate({ applicationId, stageId });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/recruiting')}>
        <ArrowLeft className="h-4 w-4" />
        Volver a vacantes
      </Button>

      <PageHeader
        title={job?.title ?? 'Pipeline'}
        description={`${job?.code ?? ''} · ${job?.openings ?? 1} cupo(s) · ${(data ?? []).reduce(
          (acc, column) => acc + column.applications.length,
          0,
        )} postulaciones`}
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {(data ?? []).map((column) => (
            <StageColumnView
              key={column.stage.id}
              column={column}
              onHire={setHiring}
              onReject={setRejecting}
              canHire={can('recruiting.hire.execute')}
            />
          ))}
        </div>
      </DndContext>

      <HireDialog application={hiring} jobId={id} onClose={() => setHiring(null)} />
      <RejectDialog application={rejecting} jobId={id} onClose={() => setRejecting(null)} />
    </div>
  );
}

function StageColumnView({
  column,
  onHire,
  onReject,
  canHire,
}: {
  column: StageColumn;
  onHire: (application: StageColumn['applications'][number]) => void;
  onReject: (application: StageColumn['applications'][number]) => void;
  canHire: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 p-2 transition-colors',
        isOver && 'ring-2 ring-primary',
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: column.stage.color }}
        />
        <p className="flex-1 text-sm font-semibold">{column.stage.name}</p>
        <Badge tone="muted">{column.applications.length}</Badge>
      </div>

      <div className="space-y-2">
        {column.applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            stageKind={column.stage.kind}
            onHire={onHire}
            onReject={onReject}
            canHire={canHire}
          />
        ))}
        {column.applications.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin candidatos</p>
        ) : null}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  stageKind,
  onHire,
  onReject,
  canHire,
}: {
  application: StageColumn['applications'][number];
  stageKind: string;
  onHire: (application: StageColumn['applications'][number]) => void;
  onReject: (application: StageColumn['applications'][number]) => void;
  canHire: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('cursor-grab p-3 active:cursor-grabbing', isDragging && 'opacity-50')}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <Avatar name={application.candidate.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{application.candidate.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{application.candidate.email}</p>
        </div>
        {application.candidate.rating ? (
          <span className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star className="h-3 w-3 fill-current" />
            {application.candidate.rating}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
        <Badge tone="muted" className="text-[10px]">
          {application.source}
        </Badge>
        <span>{formatDate(application.appliedAt)}</span>
        {application.interviews.length ? (
          <Badge tone="info" className="text-[10px]">
            {application.interviews.length} entrevista(s)
          </Badge>
        ) : null}
      </div>

      {application.status === 'active' ? (
        <div className="mt-2 flex gap-1">
          {stageKind === 'offer' && canHire ? (
            <Button
              size="sm"
              className="h-7 flex-1 text-xs"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onHire(application)}
            >
              <UserCheck className="h-3 w-3" />
              Contratar
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onReject(application)}
          >
            <XCircle className="h-3 w-3" />
            Descartar
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function HireDialog({
  application,
  onClose,
}: {
  application: StageColumn['applications'][number] | null;
  jobId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    hiredAt: new Date().toISOString().slice(0, 10),
    contractType: 'indefinido',
    workModality: 'onsite',
    createUserAccount: true,
  });
  const [error, setError] = React.useState<string | null>(null);

  const hire = useMutation({
    mutationFn: () => apiPost(`/recruiting/applications/${application?.id}/hire`, form),
    onSuccess: () => {
      toast.success(
        'Candidato contratado',
        'Se creo el colaborador, su usuario, el legajo y el proceso de ingreso.',
      );
      void queryClient.invalidateQueries({ queryKey: ['recruiting'] });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      onClose();
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={Boolean(application)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contratar a {application?.candidate.fullName}</DialogTitle>
          <DialogDescription>
            Al confirmar se crea el colaborador con sus datos, la cuenta de acceso, el legajo con el
            CV y el proceso de onboarding, sin intervencion manual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha de ingreso" required>
            <Input
              type="date"
              value={form.hiredAt}
              onChange={(event) => setForm({ ...form, hiredAt: event.target.value })}
            />
          </Field>
          <Field label="Tipo de contrato">
            <NativeSelect
              value={form.contractType}
              onChange={(event) => setForm({ ...form, contractType: event.target.value })}
            >
              <option value="indefinido">Termino indefinido</option>
              <option value="fijo">Termino fijo</option>
              <option value="obra_labor">Obra o labor</option>
              <option value="aprendizaje">Aprendizaje</option>
            </NativeSelect>
          </Field>
          <Field label="Modalidad">
            <NativeSelect
              value={form.workModality}
              onChange={(event) => setForm({ ...form, workModality: event.target.value })}
            >
              <option value="onsite">Presencial</option>
              <option value="hybrid">Hibrida</option>
              <option value="remote">Remota</option>
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.createUserAccount}
              onChange={(event) => setForm({ ...form, createUserAccount: event.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Crear usuario y enviar invitacion
          </label>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={hire.isPending}
            onClick={() => {
              setError(null);
              const parsed = hireCandidateSchema.safeParse(form);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              hire.mutate();
            }}
          >
            Confirmar contratacion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  application,
  jobId,
  onClose,
}: {
  application: StageColumn['applications'][number] | null;
  jobId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = React.useState('perfil_no_ajusta');
  const [note, setNote] = React.useState('');
  const [keepInPool, setKeepInPool] = React.useState(true);

  const reject = useMutation({
    mutationFn: () =>
      apiPost(`/recruiting/applications/${application?.id}/reject`, {
        reason,
        keepInTalentPool: keepInPool,
        notifyCandidate: true,
        note: note || null,
      }),
    onSuccess: () => {
      toast.success('Postulacion descartada');
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'pipeline', jobId] });
      onClose();
      setNote('');
    },
    onError: (error: Error) => toast.error('No fue posible descartar', error.message),
  });

  return (
    <Dialog open={Boolean(application)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar postulacion</DialogTitle>
          <DialogDescription>
            El motivo de descarte es obligatorio y queda registrado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Motivo" required>
            <NativeSelect value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="perfil_no_ajusta">El perfil no se ajusta</option>
              <option value="expectativa_salarial">Expectativa salarial fuera de rango</option>
              <option value="desistio">El candidato desistio</option>
              <option value="no_asistio">No asistio a la entrevista</option>
              <option value="otro_candidato">Se selecciono otro candidato</option>
              <option value="referencias">Referencias desfavorables</option>
            </NativeSelect>
          </Field>
          <Field label="Nota interna">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepInPool}
              onChange={(event) => setKeepInPool(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Mantener en el banco de candidatos
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" loading={reject.isPending} onClick={() => reject.mutate()}>
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
