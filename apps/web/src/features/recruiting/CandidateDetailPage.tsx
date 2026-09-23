import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, FileText, Save, Star } from 'lucide-react';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { toast } from '@/components/ui/overlays';
import { ScheduleDialog } from './InterviewsPage';

interface CandidateDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  linkedinUrl: string | null;
  source: string;
  resumeText: string | null;
  rating: number | null;
  notes: string | null;
  consentAt: string | null;
  retentionUntil: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  tags: Array<{ id: string; tag: string }>;
  documents: Array<{ id: string; fileId: string; kind: string; name: string }>;
  applications: Array<{
    id: string;
    status: string;
    appliedAt: string;
    jobPosting: { id: string; title: string; code: string; status: string };
    stage: { id: string; name: string; color: string; kind: string } | null;
    _count: { interviews: number; offers: number };
  }>;
  referrals: Array<{ id: string; createdAt: string; employee: { id: string; fullName: string } }>;
  referredBy: { id: string; fullName: string } | null;
  hiredEmployee: { id: string; fullName: string; employeeCode: string } | null;
}

/** Everything the recruiting team knows about one person, across postings. */
export function CandidateDetailPage() {
  const { id = '' } = useParams();
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [interviewFor, setInterviewFor] = React.useState<
    CandidateDetail['applications'][number] | null
  >(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'candidate', id],
    queryFn: () => apiGet<CandidateDetail>(`/recruiting/candidates/${id}`),
  });

  const [notes, setNotes] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [rating, setRating] = React.useState<number | null>(null);
  const [resumeText, setResumeText] = React.useState('');
  React.useEffect(() => {
    if (!data) return;
    setNotes(data.notes ?? '');
    setTags(data.tags.map((tag) => tag.tag).join(', '));
    setRating(data.rating);
    setResumeText(data.resumeText ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/recruiting/candidates/${id}`, {
        notes: notes || null,
        rating,
        resumeText: resumeText || null,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Ficha actualizada');
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'candidate', id] });
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'candidates'] });
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const canEdit = can('recruiting.candidate.update') && !data.anonymizedAt;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.fullName}
        description={`${data.email}${data.phone ? ` · ${data.phone}` : ''}${data.city ? ` · ${data.city}` : ''}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/recruiting/candidatos">
              <ArrowLeft className="h-4 w-4" />
              Candidatos
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Postulaciones</CardTitle>
            </CardHeader>
            <CardContent>
              {data.applications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin postulaciones.</p>
              ) : (
                <ul className="divide-y">
                  {data.applications.map((application) => (
                    <li
                      key={application.id}
                      className="flex flex-wrap items-center gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/recruiting/jobs/${application.jobPosting.id}`}
                          className="font-medium hover:underline"
                        >
                          {application.jobPosting.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {application.jobPosting.code} · postulado el{' '}
                          {formatDate(application.appliedAt)} · {application._count.interviews}{' '}
                          entrevistas · {application._count.offers} ofertas
                        </p>
                      </div>
                      {application.stage ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs text-white"
                          style={{ backgroundColor: application.stage.color }}
                        >
                          {application.stage.name}
                        </span>
                      ) : null}
                      <Badge tone={statusTone(application.status)}>
                        {statusLabel(application.status)}
                      </Badge>
                      {can('recruiting.interview.create') &&
                      !['hired', 'rejected', 'withdrawn'].includes(application.status) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInterviewFor(application)}
                        >
                          <CalendarPlus className="h-4 w-4" />
                          Entrevista
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas del equipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Valoracion</span>
                <div className="flex gap-1" role="radiogroup" aria-label="Valoracion del candidato">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} de 5`}
                      disabled={!canEdit}
                      onClick={() => setRating(rating === n ? null : n)}
                      className="rounded p-0.5 hover:bg-accent disabled:cursor-default"
                    >
                      <Star
                        className={cn(
                          'h-5 w-5',
                          rating && n <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/40',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Etiquetas" hint="Separadas por coma">
                <Input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Notas internas">
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Texto de la hoja de vida" hint="Se usa en la busqueda del talent pool">
                <Textarea
                  rows={6}
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              {canEdit ? (
                <Button loading={save.isPending} onClick={() => save.mutate()}>
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={data.fullName} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{data.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Fuente: {data.source}
                    {data.referredBy ? ` · referido por ${data.referredBy.fullName}` : ''}
                  </p>
                </div>
              </div>
              {data.linkedinUrl ? (
                <a
                  href={data.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-primary underline"
                >
                  {data.linkedinUrl}
                </a>
              ) : null}
              <p>
                <span className="text-muted-foreground">Registrado: </span>
                {formatDateTime(data.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Consentimiento: </span>
                {data.consentAt ? formatDateTime(data.consentAt) : 'sin registro'}
              </p>
              <p>
                <span className="text-muted-foreground">Retencion hasta: </span>
                {data.retentionUntil ? formatDate(data.retentionUntil) : 'sin limite'}
              </p>
              {data.anonymizedAt ? (
                <Badge tone="muted">Anonimizado el {formatDate(data.anonymizedAt)}</Badge>
              ) : null}
              {data.hiredEmployee ? (
                <p>
                  <span className="text-muted-foreground">Contratado: </span>
                  <Link
                    to={`/people/employees/${data.hiredEmployee.id}`}
                    className="text-primary underline"
                  >
                    {data.hiredEmployee.fullName} ({data.hiredEmployee.employeeCode})
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {data.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin documentos adjuntos.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{document.name}</span>
                      <Badge tone="muted">{document.kind}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.referrals.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Referidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {data.referrals.map((referral) => (
                    <li key={referral.id}>
                      {referral.employee.fullName}{' '}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(referral.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {interviewFor ? (
        <ScheduleDialog
          open
          onOpenChange={(open) => (!open ? setInterviewFor(null) : undefined)}
          applicationId={interviewFor.id}
          candidateName={data.fullName}
        />
      ) : null}
    </div>
  );
}
