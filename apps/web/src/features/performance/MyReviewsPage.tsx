import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
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

interface Assignment {
  id: string;
  relationType: string;
  status: string;
  cycle: {
    id: string;
    name: string;
    type: string;
    status: string;
    evalEnd: string | null;
    templateId: string | null;
  };
  subject: { id: string; fullName: string; position: { name: string } | null };
}

interface Competency {
  id: string;
  name: string;
  category: string | null;
}

export function MyReviewsPage() {
  const [answering, setAnswering] = React.useState<Assignment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'my-assignments'],
    queryFn: () => apiGet<Assignment[]>('/performance/assignments/mine'),
  });

  const rows = data ?? [];
  const pending = rows.filter((row) => row.status !== 'submitted');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis evaluaciones"
        description="Autoevaluacion y evaluaciones que debe responder en el ciclo vigente."
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Sin evaluaciones asignadas"
          description="Cuando se abra un ciclo y se le asigne un evaluado lo vera aqui."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((assignment) => (
            <Card key={assignment.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={assignment.subject.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {assignment.relationType === 'self'
                        ? 'Autoevaluacion'
                        : assignment.subject.fullName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {assignment.subject.position?.name ?? '—'}
                    </p>
                  </div>
                  <Badge tone={statusTone(assignment.status)}>
                    {statusLabel(assignment.status)}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge tone="muted">{assignment.cycle.name}</Badge>
                  <Badge tone="info">{statusLabel(assignment.relationType)}</Badge>
                </div>

                {assignment.cycle.evalEnd ? (
                  <p className="text-xs text-muted-foreground">
                    Cierra el {formatDate(assignment.cycle.evalEnd)}
                  </p>
                ) : null}

                <Button
                  size="sm"
                  className="w-full"
                  disabled={assignment.status === 'submitted'}
                  onClick={() => setAnswering(assignment)}
                >
                  {assignment.status === 'submitted' ? 'Ya respondida' : 'Responder'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Tiene {pending.length} evaluacion(es) pendientes de enviar.
        </p>
      ) : null}

      <AnswerDialog assignment={answering} onClose={() => setAnswering(null)} />
    </div>
  );
}

function AnswerDialog({
  assignment,
  onClose,
}: {
  assignment: Assignment | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [strengths, setStrengths] = React.useState('');
  const [improvements, setImprovements] = React.useState('');

  const { data: competencies } = useQuery({
    queryKey: ['performance', 'competencies'],
    queryFn: () => apiGet<Competency[]>('/performance/competencies'),
    enabled: Boolean(assignment),
    retry: false,
  });

  const items = (competencies ?? []).slice(0, 6);

  const submit = useMutation({
    mutationFn: () =>
      apiPost(`/performance/assignments/${assignment?.id}/submit`, {
        responses: [
          ...items.map((competency) => ({
            questionKey: `comp_${competency.id.slice(0, 8)}`,
            competencyId: competency.id,
            rating: ratings[competency.id] ?? 3,
          })),
          { questionKey: 'fortalezas', comment: strengths },
          { questionKey: 'mejoras', comment: improvements },
        ],
      }),
    onSuccess: () => {
      toast.success('Evaluacion enviada');
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      onClose();
      setRatings({});
      setStrengths('');
      setImprovements('');
    },
    onError: (error: Error) => toast.error('No fue posible enviar', error.message),
  });

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {assignment?.relationType === 'self'
              ? 'Autoevaluacion'
              : `Evaluacion de ${assignment?.subject.fullName}`}
          </DialogTitle>
          <DialogDescription>
            Califique de 1 (muy bajo) a 5 (sobresaliente) con base en hechos observables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {items.map((competency) => (
            <div key={competency.id} className="space-y-1.5">
              <p className="text-sm font-medium">{competency.name}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRatings({ ...ratings, [competency.id]: value })}
                    className={`h-9 flex-1 rounded-md border text-sm font-medium transition-colors ${
                      ratings[competency.id] === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Principales fortalezas observadas</p>
            <Textarea
              value={strengths}
              onChange={(event) => setStrengths(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Oportunidades de mejora</p>
            <Textarea
              value={improvements}
              onChange={(event) => setImprovements(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={submit.isPending}
            disabled={Object.keys(ratings).length < items.length}
            onClick={() => submit.mutate()}
          >
            Enviar evaluacion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
