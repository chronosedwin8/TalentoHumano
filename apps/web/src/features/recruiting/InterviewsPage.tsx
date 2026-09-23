import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Download, Star } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmployeePicker } from '@/components/EmployeePicker';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Button,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@/components/ui/overlays';

interface InterviewRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  locationText: string | null;
  meetingUrl: string | null;
  blindUntilComplete: boolean;
  application: {
    id: string;
    candidate: { id: string; fullName: string; email: string };
    jobPosting: { id: string; title: string; code: string };
  };
  participants: Array<{ employeeId: string; employee: { id: string; fullName: string } }>;
  _count: { feedback: number };
}

interface InterviewDetail extends InterviewRow {
  application: InterviewRow['application'] & {
    jobPosting: InterviewRow['application']['jobPosting'] & {
      competencies: Array<{ competency: { id: string; name: string; category: string | null } }>;
    };
  };
  feedback: Array<{
    id: string;
    reviewerEmployeeId: string;
    reviewerName: string | null;
    overallRating: number;
    recommendation: string;
    strengths: string | null;
    concerns: string | null;
    notes: string | null;
    ratings: Array<{
      competencyId: string;
      rating: number;
      comment: string | null;
      competency: { name: string };
    }>;
  }>;
  blind: boolean;
  submittedCount: number;
  expectedCount: number;
  myFeedbackId: string | null;
}

const KIND_LABELS: Record<string, string> = {
  hr: 'Talento Humano',
  technical: 'Tecnica',
  manager: 'Jefe',
  panel: 'Panel',
  final: 'Final',
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_yes: 'Contratar sin duda',
  yes: 'Contratar',
  neutral: 'Neutral',
  no: 'No contratar',
  strong_no: 'Descartar',
};

/** Interview agenda, scheduling and scorecards (blind until everyone submits). */
export function InterviewsPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [range, setRange] = React.useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const today = new Date().toISOString();
  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'interviews', { page, range }],
    queryFn: () =>
      apiList<InterviewRow>('/recruiting/interviews', {
        page,
        limit: 25,
        ...(range === 'upcoming' ? { from: today } : {}),
        ...(range === 'past' ? { to: today, sort: '-scheduledAt' } : {}),
      }),
  });

  const columns: Array<Column<InterviewRow>> = [
    {
      key: 'scheduledAt',
      header: 'Fecha',
      render: (row) => (
        <span className="tabular-nums">
          {formatDateTime(row.scheduledAt)}
          <span className="block text-xs text-muted-foreground">{row.durationMinutes} min</span>
        </span>
      ),
    },
    {
      key: 'candidate',
      header: 'Candidato',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.application.candidate.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.application.jobPosting.title}
          </p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Entrevista',
      hideOnMobile: true,
      render: (row) => (
        <span>
          {row.title} <Badge tone="muted">{KIND_LABELS[row.kind] ?? row.kind}</Badge>
        </span>
      ),
    },
    {
      key: 'participants',
      header: 'Entrevistadores',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm">
          {row.participants.map((participant) => participant.employee.fullName).join(', ') || '—'}
          <span className="block text-xs text-muted-foreground">
            {row._count.feedback}/{row.participants.length} evaluaciones
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrevistas"
        description="Agenda, invitaciones de calendario y tarjetas de evaluacion por competencia."
        actions={
          can('recruiting.interview.create') ? (
            <Button onClick={() => setScheduleOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              Programar entrevista
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
        onRowClick={(row) => setSelected(row.id)}
        emptyTitle="Sin entrevistas"
        emptyDescription="Programe la primera desde una postulacion del tablero o desde aqui."
        toolbar={
          <NativeSelect
            value={range}
            onChange={(event) => {
              setRange(event.target.value as typeof range);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="upcoming">Proximas</option>
            <option value="past">Pasadas</option>
            <option value="all">Todas</option>
          </NativeSelect>
        }
      />

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
      {selected ? <InterviewDialog id={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

/* ------------------------------ scheduling ------------------------------ */

interface PipelineColumn {
  stage: { id: string; name: string };
  applications: Array<{ id: string; candidate: { fullName: string } }>;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  applicationId: presetApplicationId,
  candidateName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When opened from a candidate card the application is already known. */
  applicationId?: string;
  candidateName?: string;
}) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = React.useState('');
  const [applicationId, setApplicationId] = React.useState(presetApplicationId ?? '');
  const [form, setForm] = React.useState({
    title: 'Entrevista',
    kind: 'hr',
    scheduledAt: '',
    durationMinutes: '60',
    locationText: '',
    meetingUrl: '',
    blindUntilComplete: true,
  });
  const [participants, setParticipants] = React.useState<Array<{ id: string; fullName: string }>>(
    [],
  );
  const [pickerValue, setPickerValue] = React.useState<string | null>(null);

  const { data: jobs } = useQuery({
    queryKey: ['recruiting', 'jobs', 'select'],
    queryFn: () =>
      apiList<{ id: string; title: string; code: string }>('/recruiting/jobs', { limit: 100 }),
    enabled: open && !presetApplicationId,
    retry: false,
  });
  const { data: pipeline } = useQuery({
    queryKey: ['recruiting', 'pipeline', jobId],
    queryFn: () => apiGet<PipelineColumn[]>(`/recruiting/jobs/${jobId}/pipeline`),
    enabled: open && Boolean(jobId) && !presetApplicationId,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/recruiting/interviews', {
        applicationId,
        title: form.title,
        kind: form.kind,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        locationText: form.locationText || null,
        meetingUrl: form.meetingUrl || null,
        blindUntilComplete: form.blindUntilComplete,
        participantEmployeeIds: participants.map((participant) => participant.id),
      }),
    onSuccess: () => {
      toast.success('Entrevista programada');
      void queryClient.invalidateQueries({ queryKey: ['recruiting'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible programar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Programar entrevista</DialogTitle>
          <DialogDescription>
            {candidateName
              ? `Candidato: ${candidateName}`
              : 'Elija la vacante y la postulacion; los entrevistadores reciben la invitacion.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!presetApplicationId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vacante" required>
                <NativeSelect
                  value={jobId}
                  onChange={(event) => {
                    setJobId(event.target.value);
                    setApplicationId('');
                  }}
                >
                  <option value="">Seleccione...</option>
                  {(jobs?.data ?? []).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.code} · {job.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Candidato" required>
                <NativeSelect
                  value={applicationId}
                  onChange={(event) => setApplicationId(event.target.value)}
                  disabled={!jobId}
                >
                  <option value="">Seleccione...</option>
                  {(pipeline ?? []).flatMap((column) =>
                    column.applications.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.candidate.fullName} · {column.stage.name}
                      </option>
                    )),
                  )}
                </NativeSelect>
              </Field>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Titulo" required>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label="Tipo">
              <NativeSelect
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value })}
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha y hora" required>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
              />
            </Field>
            <Field label="Duracion (minutos)">
              <Input
                type="number"
                min={15}
                max={480}
                step={15}
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              />
            </Field>
            <Field label="Lugar">
              <Input
                value={form.locationText}
                onChange={(event) => setForm({ ...form, locationText: event.target.value })}
                placeholder="Sala, sede..."
              />
            </Field>
            <Field label="Enlace de videollamada">
              <Input
                value={form.meetingUrl}
                onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })}
                placeholder="https://"
              />
            </Field>
          </div>
          <Field label="Entrevistadores" hint="Cada uno evalua por separado">
            <div className="space-y-2">
              <EmployeePicker
                value={pickerValue}
                placeholder="Agregar entrevistador"
                onChange={(id, employee) => {
                  setPickerValue(null);
                  if (id && employee && !participants.some((p) => p.id === id)) {
                    setParticipants([...participants, { id, fullName: employee.fullName }]);
                  }
                }}
              />
              {participants.length ? (
                <div className="flex flex-wrap gap-1">
                  {participants.map((participant) => (
                    <button
                      key={participant.id}
                      type="button"
                      className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
                      onClick={() =>
                        setParticipants(participants.filter((p) => p.id !== participant.id))
                      }
                      aria-label={`Quitar a ${participant.fullName}`}
                    >
                      {participant.fullName} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.blindUntilComplete}
              onCheckedChange={(checked) =>
                setForm({ ...form, blindUntilComplete: checked === true })
              }
            />
            Evaluacion ciega: nadie ve las tarjetas ajenas hasta que todos entreguen
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!applicationId || !form.scheduledAt || form.title.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- detail -------------------------------- */

function InterviewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const can = useAuth((state) => state.can);
  const employeeId = useAuth((state) => state.user?.employee?.id ?? null);
  const queryClient = useQueryClient();
  const [scoring, setScoring] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'interview', id],
    queryFn: () => apiGet<InterviewDetail>(`/recruiting/interviews/${id}`),
  });

  const downloadIcs = async () => {
    const file = await apiGet<{ filename: string; content: string }>(
      `/recruiting/interviews/${id}/ics`,
    );
    const blob = new Blob([file.content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const isParticipant = Boolean(
    employeeId && data?.participants.some((participant) => participant.employeeId === employeeId),
  );

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
        {isLoading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{data.title}</DialogTitle>
              <DialogDescription>
                {data.application.candidate.fullName} · {data.application.jobPosting.title} ·{' '}
                {formatDateTime(data.scheduledAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="muted">{KIND_LABELS[data.kind] ?? data.kind}</Badge>
              <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
              {data.meetingUrl ? (
                <a
                  href={data.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Enlace de la reunion
                </a>
              ) : data.locationText ? (
                <span className="text-muted-foreground">{data.locationText}</span>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void downloadIcs()}>
                <Download className="h-4 w-4" />
                Calendario (.ics)
              </Button>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Tarjetas de evaluacion ({data.submittedCount}/{data.expectedCount})
              </h3>
              {data.blind ? (
                <p className="rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/30">
                  Evaluacion ciega activa: solo ve su propia tarjeta hasta que todos los
                  entrevistadores entreguen la suya.
                </p>
              ) : null}
              {data.feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aun no hay evaluaciones.</p>
              ) : (
                <ul className="space-y-2">
                  {data.feedback.map((card) => (
                    <li key={card.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{card.reviewerName ?? 'Entrevistador'}</span>
                        <Stars value={card.overallRating} />
                        <Badge
                          tone={
                            card.recommendation.endsWith('yes')
                              ? 'success'
                              : card.recommendation.endsWith('no')
                                ? 'danger'
                                : 'muted'
                          }
                        >
                          {RECOMMENDATION_LABELS[card.recommendation] ?? card.recommendation}
                        </Badge>
                      </div>
                      {card.ratings.length ? (
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {card.ratings.map((rating) => (
                            <li key={rating.competencyId} className="flex items-center gap-2">
                              <span className="flex-1 truncate">{rating.competency.name}</span>
                              <Stars value={rating.rating} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {card.strengths ? (
                        <p className="mt-2">
                          <span className="text-muted-foreground">Fortalezas: </span>
                          {card.strengths}
                        </p>
                      ) : null}
                      {card.concerns ? (
                        <p>
                          <span className="text-muted-foreground">Dudas: </span>
                          {card.concerns}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              {isParticipant && can('recruiting.scorecard.create') ? (
                <Button onClick={() => setScoring(true)}>
                  <Star className="h-4 w-4" />
                  {data.myFeedbackId ? 'Editar mi evaluacion' : 'Evaluar'}
                </Button>
              ) : null}
            </DialogFooter>

            {scoring ? (
              <ScorecardDialog
                interview={data}
                onClose={() => {
                  setScoring(false);
                  void queryClient.invalidateQueries({ queryKey: ['recruiting', 'interview', id] });
                  void queryClient.invalidateQueries({ queryKey: ['recruiting', 'interviews'] });
                }}
              />
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  );
}

function ScorecardDialog({
  interview,
  onClose,
}: {
  interview: InterviewDetail;
  onClose: () => void;
}) {
  const employeeId = useAuth((state) => state.user?.employee?.id ?? null);
  const mine = interview.feedback.find((card) => card.reviewerEmployeeId === employeeId);
  const competencies = interview.application.jobPosting.competencies.map((row) => row.competency);
  const [form, setForm] = React.useState({
    overallRating: mine?.overallRating ?? 3,
    recommendation: mine?.recommendation ?? 'neutral',
    strengths: mine?.strengths ?? '',
    concerns: mine?.concerns ?? '',
    notes: mine?.notes ?? '',
    ratings: Object.fromEntries(
      competencies.map((competency) => [
        competency.id,
        mine?.ratings.find((rating) => rating.competencyId === competency.id)?.rating ?? 3,
      ]),
    ) as Record<string, number>,
  });

  const submit = useMutation({
    mutationFn: () =>
      apiPost('/recruiting/scorecards', {
        interviewId: interview.id,
        overallRating: form.overallRating,
        recommendation: form.recommendation,
        strengths: form.strengths || null,
        concerns: form.concerns || null,
        notes: form.notes || null,
        ratings: competencies.map((competency) => ({
          competencyId: competency.id,
          rating: form.ratings[competency.id] ?? 3,
        })),
      }),
    onSuccess: () => {
      toast.success('Evaluacion registrada');
      onClose();
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  const ratingInput = (value: number, onChange: (next: number) => void, label: string) => (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 hover:bg-accent"
        >
          <Star
            className={cn(
              'h-5 w-5',
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent size="md" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarjeta de evaluacion</DialogTitle>
          <DialogDescription>
            {interview.application.candidate.fullName} · {interview.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {competencies.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Competencias del cargo</p>
              {competencies.map((competency) => (
                <div key={competency.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{competency.name}</span>
                  {ratingInput(
                    form.ratings[competency.id] ?? 3,
                    (next) =>
                      setForm({ ...form, ratings: { ...form.ratings, [competency.id]: next } }),
                    competency.name,
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Valoracion general</span>
            {ratingInput(
              form.overallRating,
              (next) => setForm({ ...form, overallRating: next }),
              'Valoracion general',
            )}
          </div>
          <Field label="Recomendacion" required>
            <NativeSelect
              value={form.recommendation}
              onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
            >
              {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Fortalezas">
            <Textarea
              rows={2}
              value={form.strengths}
              onChange={(event) => setForm({ ...form, strengths: event.target.value })}
            />
          </Field>
          <Field label="Dudas o riesgos">
            <Textarea
              rows={2}
              value={form.concerns}
              onChange={(event) => setForm({ ...form, concerns: event.target.value })}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            Guardar evaluacion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
