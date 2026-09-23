import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { apiGet } from '@/lib/api';
import { cn, statusLabel } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  NativeSelect,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/overlays';

interface CalendarData {
  absences: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    leaveType: { name: string; color: string; code: string };
    employee: { id: string; fullName: string; department: { name: string } | null };
  }>;
  holidays: Array<{ id: string; date: string; name: string }>;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export function LeaveCalendarPage() {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [departmentId, setDepartmentId] = React.useState('');

  const from = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const to = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'calendar', from.toISOString(), departmentId],
    queryFn: () =>
      apiGet<CalendarData>('/leaves/calendar', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        departmentId: departmentId || undefined,
      }),
  });

  const holidayByDate = new Map(
    (data?.holidays ?? []).map((holiday) => [holiday.date.slice(0, 10), holiday]),
  );

  // Build the month grid starting on Monday.
  const firstWeekday = (from.getUTCDay() + 6) % 7;
  const daysInMonth = to.getUTCDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), index + 1)),
    ),
  ];

  const absencesOn = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
    return (data?.absences ?? []).filter(
      (absence) => absence.startDate.slice(0, 10) <= key && absence.endDate.slice(0, 10) >= key,
    );
  };

  const monthLabel = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(cursor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de ausencias"
        description="Vista mensual del equipo con festivos de Colombia."
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
              onClick={() =>
                setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))
              }
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-medium capitalize">
              {monthLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))
              }
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-[540px] w-full" />
      ) : (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, index) => {
                if (!date)
                  return <div key={`empty-${index}`} className="min-h-[92px] rounded-md" />;
                const key = date.toISOString().slice(0, 10);
                const holiday = holidayByDate.get(key);
                const dayAbsences = absencesOn(date);
                const isWeekend = [0, 6].includes(date.getUTCDay());
                const isToday = key === new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-[92px] rounded-md border p-1.5 text-xs',
                      isWeekend && 'bg-muted/40',
                      holiday && 'border-amber-500/40 bg-amber-500/10',
                      isToday && 'ring-2 ring-primary',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', isToday && 'text-primary')}>
                        {date.getUTCDate()}
                      </span>
                      {dayAbsences.length > 2 ? (
                        <span className="text-[10px] text-muted-foreground">
                          {dayAbsences.length}
                        </span>
                      ) : null}
                    </div>
                    {holiday ? (
                      <p className="mt-0.5 truncate text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        {holiday.name}
                      </p>
                    ) : null}
                    <div className="mt-1 space-y-0.5">
                      {dayAbsences.slice(0, 3).map((absence) => (
                        <Tooltip
                          key={absence.id}
                          content={`${absence.employee.fullName} · ${absence.leaveType.name} · ${statusLabel(absence.status)}`}
                        >
                          <div
                            className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                            style={{
                              backgroundColor: absence.leaveType.color,
                              opacity: absence.status === 'pending' ? 0.6 : 1,
                            }}
                          >
                            {absence.employee.fullName.split(' ')[0]}
                          </div>
                        </Tooltip>
                      ))}
                      {dayAbsences.length > 3 ? (
                        <p className="text-[10px] text-muted-foreground">
                          +{dayAbsences.length - 3} mas
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ...new Map((data?.absences ?? []).map((a) => [a.leaveType.code, a.leaveType])).values(),
        ].map((type) => (
          <Badge key={type.code} tone="muted" className="gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
            {type.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
