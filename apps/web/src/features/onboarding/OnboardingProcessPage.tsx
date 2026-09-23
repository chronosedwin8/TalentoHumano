import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Link2 } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { cn, formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Progress,
  Skeleton,
} from '@/components/ui/primitives';

interface ProcessDetail {
  id: string;
  kind: string;
  status: string;
  progress: number;
  referenceDate: string;
  preboardingToken: string | null;
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    hiredAt: string;
    position: { name: string } | null;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    ownerType: string;
    kind: string;
    status: string;
    dueDate: string | null;
    completedAt: string | null;
    isRequired: boolean;
    assignee: { fullName: string } | null;
  }>;
}

const OWNER_LABELS: Record<string, string> = {
  employee: 'Colaborador',
  manager: 'Jefe',
  hr: 'Talento Humano',
  it: 'Tecnologia',
  buddy: 'Buddy',
  other: 'Otro',
};

export function OnboardingProcessPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'process', id],
    queryFn: () => apiGet<ProcessDetail>(`/onboarding/processes/${id}`),
    enabled: Boolean(id),
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => apiPost(`/onboarding/tasks/${taskId}/complete`, { result: {} }),
    onSuccess: () => {
      toast.success('Tarea completada');
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: (error: Error) => toast.error('No fue posible completar la tarea', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const preboardingUrl = data.preboardingToken
    ? `${window.location.origin}/pre-ingreso/${data.preboardingToken}`
    : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/onboarding')}>
        <ArrowLeft className="h-4 w-4" />
        Volver al tablero
      </Button>

      <PageHeader
        title={data.kind === 'onboarding' ? 'Proceso de ingreso' : 'Proceso de salida'}
        description={`${data.employee.fullName} · ${formatDate(data.referenceDate)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Tareas ({data.tasks.length})</CardTitle>
            <CardDescription>
              Cada tarea tiene responsable y fecha relativa al dia de ingreso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.tasks.map((task) => {
              const overdue =
                task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3',
                    task.status === 'completed' && 'bg-muted/40',
                    overdue && 'border-destructive/40',
                  )}
                >
                  <button
                    type="button"
                    disabled={task.status === 'completed' || complete.isPending}
                    onClick={() => complete.mutate(task.id)}
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                      task.status === 'completed'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'hover:border-primary',
                    )}
                    aria-label="Completar tarea"
                  >
                    {task.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        task.status === 'completed' && 'text-muted-foreground line-through',
                      )}
                    >
                      {task.title}
                      {!task.isRequired ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      ) : null}
                    </p>
                    {task.description ? (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone="muted" className="text-[10px]">
                        {OWNER_LABELS[task.ownerType] ?? task.ownerType}
                      </Badge>
                      {task.assignee ? <span>{task.assignee.fullName}</span> : null}
                      {task.dueDate ? <span>Vence {formatDate(task.dueDate)}</span> : null}
                    </div>
                  </div>

                  <Badge tone={overdue ? 'danger' : statusTone(task.status)}>
                    {overdue ? 'Vencida' : statusLabel(task.status)}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progreso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={data.employee.fullName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{data.employee.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {data.employee.position?.name ?? '—'}
                  </p>
                </div>
              </div>
              <Progress
                value={data.progress}
                tone={data.progress === 100 ? 'success' : 'default'}
              />
              <p className="text-xs text-muted-foreground">
                {data.progress}% completado · estado {statusLabel(data.status)}
              </p>
            </CardContent>
          </Card>

          {preboardingUrl ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Portal de pre-ingreso</CardTitle>
                <CardDescription>
                  Enlace temporal para que la persona complete datos antes del dia 1.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <code className="block break-all rounded-md bg-muted p-2 text-xs">
                  {preboardingUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(preboardingUrl);
                    toast.success('Enlace copiado');
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar enlace
                </Button>
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <a href={preboardingUrl} target="_blank" rel="noreferrer">
                    <Link2 className="h-4 w-4" />
                    Abrir portal
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
