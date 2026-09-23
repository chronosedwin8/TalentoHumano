import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckSquare, X } from 'lucide-react';
import * as React from 'react';
import { apiList, apiPost } from '@/lib/api';
import { relativeTime, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface WorkflowInstance {
  id: string;
  title: string;
  summary: string | null;
  entityType: string;
  status: string;
  currentStep: number;
  createdAt: string;
  definition: { name: string };
  steps: Array<{
    id: string;
    name: string;
    position: number;
    status: string;
    decidedAt: string | null;
    comment: string | null;
    dueAt: string | null;
  }>;
}

const ENTITY_LABELS: Record<string, string> = {
  leave_request: 'Solicitud de ausencia',
  job_requisition: 'Requisicion de personal',
  employee_movement: 'Movimiento de personal',
  employee_event: 'Novedad',
};

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [decision, setDecision] = React.useState<{
    instance: WorkflowInstance;
    action: 'approved' | 'rejected';
  } | null>(null);
  const [comment, setComment] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', 'inbox'],
    queryFn: () => apiList<WorkflowInstance>('/workflows/inbox', { limit: 50 }),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) =>
      apiPost(`/workflows/instances/${id}/${action === 'approved' ? 'approve' : 'reject'}`, {
        comment,
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.action === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setDecision(null);
      setComment('');
    },
    onError: (error: Error) => toast.error('No fue posible registrar la decision', error.message),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandeja de aprobaciones"
        description="Todas las solicitudes que esperan su decision, sin importar el modulo."
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tiene aprobaciones pendientes"
          description="Cuando alguien envie una solicitud que dependa de usted aparecera aqui."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((instance) => {
            const currentStep = instance.steps.find(
              (step) => step.position === instance.currentStep,
            );
            return (
              <Card key={instance.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{instance.title}</p>
                      <Badge tone="muted">
                        {ENTITY_LABELS[instance.entityType] ?? instance.entityType}
                      </Badge>
                    </div>
                    {instance.summary ? (
                      <p className="text-sm text-muted-foreground">{instance.summary}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {instance.definition.name} · paso {instance.currentStep + 1} de{' '}
                      {instance.steps.length}
                      {currentStep?.dueAt ? ` · vence ${relativeTime(currentStep.dueAt)}` : ''} ·
                      solicitado {relativeTime(instance.createdAt)}
                    </p>
                    <ol className="mt-2 flex flex-wrap gap-1.5">
                      {instance.steps.map((step) => (
                        <li key={step.id}>
                          <Badge tone={statusTone(step.status)} className="text-[10px]">
                            {step.name}: {statusLabel(step.status)}
                          </Badge>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDecision({ instance, action: 'approved' });
                        setComment('');
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDecision({ instance, action: 'rejected' });
                        setComment('');
                      }}
                    >
                      <X className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === 'approved' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{decision?.instance.title}</p>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder={
                decision?.action === 'approved'
                  ? 'Comentario (opcional)'
                  : 'Explique el motivo del rechazo'
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancelar
            </Button>
            <Button
              variant={decision?.action === 'rejected' ? 'destructive' : 'default'}
              loading={decide.isPending}
              onClick={() =>
                decision && decide.mutate({ id: decision.instance.id, action: decision.action })
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
