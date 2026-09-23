import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Coffee, LogIn, LogOut, MapPin } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { formatTime, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface ClockToday {
  entries: Array<{
    id: string;
    type: string;
    occurredAt: string;
    source: string;
    withinGeofence: boolean | null;
  }>;
  day: {
    id: string;
    status: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    workedMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
  } | null;
}

const TYPE_LABELS: Record<string, string> = {
  in: 'Entrada',
  out: 'Salida',
  break_start: 'Inicio de pausa',
  break_end: 'Fin de pausa',
};

export function ClockPage() {
  const queryClient = useQueryClient();
  const [now, setNow] = React.useState(new Date());
  const [position, setPosition] = React.useState<GeolocationPosition | null>(null);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (result) => setPosition(result),
      () => setGeoError('No fue posible obtener su ubicacion. Puede marcar sin ella desde la web.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['time', 'today'],
    queryFn: () => apiGet<ClockToday>('/time/clock/today'),
    refetchInterval: 60_000,
  });

  const clock = useMutation({
    mutationFn: (type: 'in' | 'out' | 'break_start' | 'break_end') =>
      apiPost('/time/clock', {
        type,
        source: 'web',
        latitude: position?.coords.latitude ?? null,
        longitude: position?.coords.longitude ?? null,
        accuracy: position ? Math.round(position.coords.accuracy) : null,
      }),
    onSuccess: (_result, type) => {
      toast.success(`${TYPE_LABELS[type]} registrada`);
      void queryClient.invalidateQueries({ queryKey: ['time'] });
      void queryClient.invalidateQueries({ queryKey: ['portal'] });
    },
    onError: (error: Error) => toast.error('No fue posible marcar', error.message),
  });

  const entries = data?.entries ?? [];
  const lastType = entries[entries.length - 1]?.type;
  const canClockIn = !lastType || lastType === 'out';
  const canBreak = lastType === 'in' || lastType === 'break_end';
  const canEndBreak = lastType === 'break_start';
  const canClockOut = lastType === 'in' || lastType === 'break_end';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcacion"
        description="Registre su jornada desde la web o el celular."
        actions={
          <Button asChild variant="outline">
            <Link to="/time/asistencia">Ver asistencia</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div className="text-center">
              <p className="text-5xl font-semibold tabular-nums">
                {now.toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {now.toLocaleDateString('es-CO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <Button
                size="lg"
                disabled={!canClockIn}
                loading={clock.isPending}
                onClick={() => clock.mutate('in')}
              >
                <LogIn className="h-5 w-5" />
                Entrada
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={!canClockOut}
                loading={clock.isPending}
                onClick={() => clock.mutate('out')}
              >
                <LogOut className="h-5 w-5" />
                Salida
              </Button>
              <Button
                variant="secondary"
                disabled={!canBreak}
                onClick={() => clock.mutate('break_start')}
              >
                <Coffee className="h-4 w-4" />
                Iniciar pausa
              </Button>
              <Button
                variant="secondary"
                disabled={!canEndBreak}
                onClick={() => clock.mutate('break_end')}
              >
                <Coffee className="h-4 w-4" />
                Terminar pausa
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {position
                ? `Ubicacion detectada (precision ${Math.round(position.coords.accuracy)} m)`
                : (geoError ?? 'Obteniendo ubicacion...')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mi jornada de hoy</CardTitle>
            <CardDescription>
              {data?.day?.scheduledStart
                ? `Horario ${data.day.scheduledStart} a ${data.day.scheduledEnd}`
                : 'Sin horario asignado'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge tone={statusTone(data?.day?.status)}>
                    {statusLabel(data?.day?.status ?? 'pending')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tiempo trabajado</span>
                  <span className="font-medium tabular-nums">
                    {Math.floor((data?.day?.workedMinutes ?? 0) / 60)}h{' '}
                    {(data?.day?.workedMinutes ?? 0) % 60}m
                  </span>
                </div>
                {data?.day?.lateMinutes ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Retardo</span>
                    <span className="font-medium tabular-nums text-amber-600">
                      {data.day.lateMinutes} min
                    </span>
                  </div>
                ) : null}

                <div className="space-y-1 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Marcaciones
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin marcaciones registradas.</p>
                  ) : (
                    entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1">{TYPE_LABELS[entry.type] ?? entry.type}</span>
                        <span className="tabular-nums">{formatTime(entry.occurredAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
