import { useQuery } from '@tanstack/react-query';
import { ClipboardList, FileCog, PackageCheck } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

interface BoardRow {
  id: string;
  referenceDate: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    position: { name: string } | null;
    department: { name: string } | null;
  };
}

export function OnboardingBoardPage() {
  const [kind, setKind] = React.useState<'onboarding' | 'offboarding'>('onboarding');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'board', kind],
    queryFn: () => apiGet<BoardRow[]>('/onboarding/board', { kind }),
  });

  const rows = data ?? [];
  const onTime = rows.filter((row) => row.overdueTasks === 0).length;
  const completed = rows.filter((row) => row.progress === 100).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingreso y salida"
        description="Tableros de progreso con tareas, responsables y vencimientos."
        actions={
          <Button asChild variant="outline">
            <Link to="/onboarding/plantillas">
              <FileCog className="h-4 w-4" />
              Plantillas
            </Link>
          </Button>
        }
      />

      <Tabs value={kind} onValueChange={(value) => setKind(value as 'onboarding' | 'offboarding')}>
        <TabsList>
          <TabsTrigger value="onboarding">
            <PackageCheck className="h-4 w-4" />
            Ingresos
          </TabsTrigger>
          <TabsTrigger value="offboarding">
            <ClipboardList className="h-4 w-4" />
            Salidas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={kind}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Procesos en curso" value={rows.length} />
              <StatCard label="Sin tareas vencidas" value={onTime} tone="success" />
              <StatCard label="Completados" value={completed} />
            </div>

            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title={kind === 'onboarding' ? 'Sin ingresos en curso' : 'Sin salidas en curso'}
                description="Los procesos se crean automaticamente al contratar o registrar un retiro."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <Card
                    key={row.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => navigate(`/onboarding/procesos/${row.id}`)}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <Avatar name={row.employee.fullName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{row.employee.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.employee.position?.name ?? '—'}
                          </p>
                        </div>
                        <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {row.completedTasks} de {row.totalTasks} tareas
                          </span>
                          <span className="font-medium">{row.progress}%</span>
                        </div>
                        <Progress
                          value={row.progress}
                          tone={
                            row.progress === 100
                              ? 'success'
                              : row.overdueTasks > 0
                                ? 'danger'
                                : 'default'
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {kind === 'onboarding' ? 'Ingreso' : 'Retiro'}{' '}
                          {formatDate(row.referenceDate)}
                        </span>
                        {row.overdueTasks > 0 ? (
                          <Badge tone="danger">{row.overdueTasks} vencidas</Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
