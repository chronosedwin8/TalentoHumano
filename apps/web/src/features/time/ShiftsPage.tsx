import { useQuery } from '@tanstack/react-query';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  NativeSelect,
  Button,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface Assignment {
  id: string;
  date: string;
  isPublished: boolean;
  shift: {
    id: string;
    name: string;
    code: string;
    color: string;
    startTime: string;
    endTime: string;
  };
  employee: { id: string; fullName: string; employeeCode: string };
}

export function ShiftsPage() {
  const [weekStart, setWeekStart] = React.useState(() => {
    const now = new Date();
    const day = (now.getUTCDay() + 6) % 7;
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
    );
    return monday;
  });
  const [departmentId, setDepartmentId] = React.useState('');

  const from = weekStart.toISOString().slice(0, 10);
  const to = new Date(weekStart.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    retry: false,
  });

  const { data: shifts } = useQuery({
    queryKey: ['time', 'shifts'],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; code: string; color: string }>>('/time/shifts'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['time', 'planner', from, departmentId],
    queryFn: () =>
      apiGet<Assignment[]>('/time/shifts/planner', {
        from,
        to,
        departmentId: departmentId || undefined,
      }),
  });

  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(weekStart.getTime() + index * 86_400_000),
  );

  const employees = React.useMemo(() => {
    const map = new Map<string, { id: string; fullName: string; employeeCode: string }>();
    for (const assignment of data ?? []) map.set(assignment.employee.id, assignment.employee);
    return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [data]);

  const assignmentFor = (employeeId: string, date: Date) => {
    const key = date.toISOString().slice(0, 10);
    return (data ?? []).find(
      (assignment) => assignment.employee.id === employeeId && assignment.date.slice(0, 10) === key,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planificador de turnos"
        description="Grilla semanal de turnos publicados."
        actions={
          <div className="flex items-center gap-2">
            <NativeSelect
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-48"
            >
              <option value="">Todas las areas</option>
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86_400_000))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86_400_000))}
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(shifts ?? []).map((shift) => (
          <Badge key={shift.id} tone="muted" className="gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: shift.color }} />
            {shift.name}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Sin turnos asignados esta semana"
          description="Asigne turnos desde la configuracion del modulo de tiempo."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Semana del{' '}
              {days[0].toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}{' '}
              al{' '}
              {days[6].toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="sticky left-0 bg-muted/40 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Colaborador
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {day.toLocaleDateString('es-CO', { weekday: 'short', timeZone: 'UTC' })}
                      <span className="block font-normal">{day.getUTCDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="sticky left-0 bg-background px-4 py-2">
                      <p className="truncate font-medium">{employee.fullName}</p>
                      <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
                    </td>
                    {days.map((day) => {
                      const assignment = assignmentFor(employee.id, day);
                      return (
                        <td key={day.toISOString()} className="px-1.5 py-2 text-center">
                          {assignment ? (
                            <span
                              className={cn(
                                'inline-block w-full rounded px-1 py-1 text-[11px] font-medium text-white',
                                !assignment.isPublished && 'opacity-60',
                              )}
                              style={{ backgroundColor: assignment.shift.color }}
                              title={`${assignment.shift.name} (${assignment.shift.startTime} - ${assignment.shift.endTime})`}
                            >
                              {assignment.shift.code}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
