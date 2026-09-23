import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
} from '@/components/ui/primitives';

interface MyTeam {
  members: Array<{
    id: string;
    fullName: string;
    employeeCode: string;
    status: string;
    email: string;
    position: { name: string } | null;
  }>;
  absences?: Array<{
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
    leaveType: { name: string; color: string };
  }>;
  onboarding?: Array<{
    id: string;
    employeeId: string;
    kind: string;
    progress: number;
    status: string;
  }>;
}

export function MyTeamPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'my-team'],
    queryFn: () => apiGet<MyTeam>('/portal/my-team'),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const members = data?.members ?? [];
  const byEmployee = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi equipo"
        description="Colaboradores a su cargo, ausencias vigentes y procesos en curso."
      />

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tiene reportes directos"
          description="Cuando se le asignen colaboradores apareceran aqui."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Colaboradores ({members.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((member) => (
                <Link
                  key={member.id}
                  to={`/people/employees/${member.id}`}
                  className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <Avatar name={member.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{member.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.position?.name ?? '—'} · {member.employeeCode}
                    </p>
                  </div>
                  <Badge tone={statusTone(member.status)}>{statusLabel(member.status)}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ausencias vigentes</CardTitle>
                <CardDescription>Aprobadas y en tramite</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.absences ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin ausencias proximas.</p>
                ) : (
                  data?.absences?.map((absence) => (
                    <div key={absence.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: absence.leaveType.color }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {byEmployee.get(absence.employeeId)?.fullName ?? 'Colaborador'}
                        </span>
                        <Badge tone={statusTone(absence.status)}>
                          {statusLabel(absence.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {absence.leaveType.name} · {formatDate(absence.startDate)} —{' '}
                        {formatDate(absence.endDate)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Procesos de ingreso y salida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.onboarding ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin procesos abiertos.</p>
                ) : (
                  data?.onboarding?.map((process) => (
                    <div key={process.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">
                          {byEmployee.get(process.employeeId)?.fullName ?? 'Colaborador'}
                        </span>
                        <span className="text-xs text-muted-foreground">{process.progress}%</span>
                      </div>
                      <Progress
                        value={process.progress}
                        tone={process.status === 'overdue' ? 'danger' : 'default'}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
