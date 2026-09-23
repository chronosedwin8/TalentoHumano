import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Circle, MapPin, PartyPopper, UserRound } from 'lucide-react';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Skeleton,
} from '@/components/ui/primitives';
import { PublicShell, type PublicCompany } from './PublicShell';

interface Preboarding {
  company: PublicCompany;
  processId: string;
  employee: {
    id: string;
    firstName: string;
    fullName: string;
    hiredAt: string | null;
    position: { name: string } | null;
    department: { name: string } | null;
    location: { name: string; city: string | null } | null;
    manager: { fullName: string } | null;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    kind: string;
    status: string;
    dueDate: string | null;
  }>;
}

/**
 * What a new hire sees between signing and their first day. It needs no
 * session: the single-use link in the welcome email is the credential.
 */
export function PreboardingPage() {
  const { token = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'preboarding', token],
    queryFn: () => apiGet<Preboarding>(`/onboarding/preboarding/${token}`),
    retry: false,
  });

  if (isError) {
    return (
      <PublicShell title="Bienvenida">
        <EmptyState
          icon={PartyPopper}
          title="Enlace no valido"
          description="Pida a su contacto en talento humano que le reenvie la invitacion."
        />
      </PublicShell>
    );
  }

  if (isLoading || !data) {
    return (
      <PublicShell>
        <Skeleton className="h-96 w-full" />
      </PublicShell>
    );
  }

  const done = data.tasks.filter((task) => task.status === 'completed').length;
  const progress = data.tasks.length ? (done / data.tasks.length) * 100 : 0;

  return (
    <PublicShell
      company={data.company}
      title={`Bienvenido, ${data.employee.firstName}`}
      subtitle="Esto es lo que necesita saber y preparar antes de su primer dia."
      className="max-w-3xl"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Su vinculacion</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info
              icon={CalendarDays}
              label="Primer dia"
              value={data.employee.hiredAt ? formatDate(data.employee.hiredAt) : 'Por confirmar'}
            />
            <Info
              icon={UserRound}
              label="Cargo"
              value={data.employee.position?.name ?? 'Por confirmar'}
            />
            <Info
              icon={MapPin}
              label="Sede"
              value={
                data.employee.location
                  ? (data.employee.location.city ?? data.employee.location.name)
                  : 'Por confirmar'
              }
            />
            <Info
              icon={UserRound}
              label="Su jefe directo"
              value={data.employee.manager?.fullName ?? 'Por confirmar'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lo que debe preparar</CardTitle>
            <CardDescription>
              {done} de {data.tasks.length} completadas. Su contacto de talento humano marcara cada
              punto cuando reciba la documentacion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} tone={progress === 100 ? 'success' : 'default'} />
            {data.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pendientes: solo lo esperamos el primer dia.
              </p>
            ) : (
              <div className="space-y-2">
                {data.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 rounded-md border p-3 text-sm"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          task.status === 'completed'
                            ? 'font-medium text-muted-foreground line-through'
                            : 'font-medium'
                        }
                      >
                        {task.title}
                      </p>
                      {task.description ? (
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      ) : null}
                    </div>
                    {task.dueDate && task.status !== 'completed' ? (
                      <Badge tone={new Date(task.dueDate) < new Date() ? 'danger' : 'muted'}>
                        {formatDate(task.dueDate)}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex gap-3 p-4 text-sm">
            <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              El primer dia recibira sus credenciales para entrar al portal del colaborador, donde
              podra consultar su informacion, solicitar vacaciones y ver sus cursos asignados.
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
