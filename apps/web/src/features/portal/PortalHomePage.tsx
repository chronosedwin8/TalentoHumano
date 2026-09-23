import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  LogIn,
  LogOut,
  Megaphone,
  Target,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Skeleton,
} from '@/components/ui/primitives';

interface PortalHome {
  attendanceToday: {
    id: string;
    status: string;
    firstIn: string | null;
    lastOut: string | null;
  } | null;
  balance: {
    availableDays: number;
    accruedDays: number;
    takenDays: number;
    pendingDays: number;
  } | null;
  pending: {
    tasks: number;
    courses: number;
    reviews: number;
    surveys: number;
    policies: number;
    approvals: number;
  };
  myRequests: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    requestedDays: string;
    leaveType: { name: string; color: string };
  }>;
  feed: Array<{
    id: string;
    title: string;
    excerpt: string | null;
    requiresAck: boolean;
    publishedAt: string;
  }>;
  recognitions: Array<{
    id: string;
    message: string;
    createdAt: string;
    from: { fullName: string } | null;
    value: { name: string } | null;
  }>;
}

export function PortalHomePage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'home'],
    queryFn: () => apiGet<PortalHome>('/portal/home'),
  });

  const clock = useMutation({
    mutationFn: (type: 'in' | 'out') => apiPost('/time/clock', { type, source: 'web' }),
    onSuccess: (_result, type) => {
      toast.success(type === 'in' ? 'Entrada registrada' : 'Salida registrada');
      void queryClient.invalidateQueries({ queryKey: ['portal', 'home'] });
    },
    onError: (error: Error) => toast.error('No fue posible marcar', error.message),
  });

  const pending = data?.pending;
  const hasClockedIn = Boolean(data?.attendanceToday?.firstIn);
  const hasClockedOut = Boolean(data?.attendanceToday?.lastOut);

  const shortcuts = [
    { to: '/portal/tareas', icon: CheckSquare, label: 'Tareas de ingreso', count: pending?.tasks },
    { to: '/learning', icon: BookOpen, label: 'Mis cursos', count: pending?.courses },
    {
      to: '/performance/mis-evaluaciones',
      icon: Target,
      label: 'Evaluaciones',
      count: pending?.reviews,
    },
    { to: '/surveys', icon: ClipboardList, label: 'Encuestas', count: pending?.surveys },
    {
      to: '/documents/policies',
      icon: FileSignature,
      label: 'Politicas por firmar',
      count: pending?.policies,
    },
    { to: '/approvals', icon: CheckSquare, label: 'Aprobaciones', count: pending?.approvals },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Hola, {user?.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.employee?.positionName ?? 'Colaborador'}
            {user?.employee?.departmentName ? ` · ${user.employee.departmentName}` : ''}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => clock.mutate('in')}
            loading={clock.isPending && clock.variables === 'in'}
            disabled={hasClockedIn}
          >
            <LogIn className="h-4 w-4" />
            Registrar entrada
          </Button>
          <Button
            variant="outline"
            onClick={() => clock.mutate('out')}
            loading={clock.isPending && clock.variables === 'out'}
            disabled={!hasClockedIn || hasClockedOut}
          >
            <LogOut className="h-4 w-4" />
            Registrar salida
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mi jornada de hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada</span>
                  <span className="font-medium tabular-nums">
                    {formatTime(data?.attendanceToday?.firstIn)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salida</span>
                  <span className="font-medium tabular-nums">
                    {formatTime(data?.attendanceToday?.lastOut)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge tone={statusTone(data?.attendanceToday?.status)}>
                    {statusLabel(data?.attendanceToday?.status ?? 'pending')}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saldo de vacaciones</CardTitle>
            <CardDescription>Solo control de dias, sin valores monetarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-3xl font-semibold tabular-nums">
                  {data?.balance?.availableDays ?? 0}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    dias disponibles
                  </span>
                </p>
                <Progress
                  value={
                    data?.balance && data.balance.accruedDays
                      ? (data.balance.takenDays / data.balance.accruedDays) * 100
                      : 0
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Causados {data?.balance?.accruedDays ?? 0} · disfrutados{' '}
                  {data?.balance?.takenDays ?? 0} · en tramite {data?.balance?.pendingDays ?? 0}
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/leaves">
                    <CalendarDays className="h-4 w-4" />
                    Solicitar vacaciones
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.to + shortcut.label}
                to={shortcut.to}
                className="flex items-center gap-2 rounded-md border p-2 text-sm transition-colors hover:bg-accent"
              >
                <shortcut.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs">{shortcut.label}</span>
                {shortcut.count ? (
                  <Badge tone="default" className="shrink-0">
                    {shortcut.count}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" />
              Mis solicitudes recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.myRequests ?? []).length === 0 ? (
              <EmptyState
                title="Sin solicitudes"
                description="Cuando solicite una ausencia la vera aqui."
              />
            ) : (
              (data?.myRequests ?? []).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: request.leaveType.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{request.leaveType.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.startDate)} — {formatDate(request.endDate)} ·{' '}
                      {Number(request.requestedDays)} dias
                    </p>
                  </div>
                  <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="h-4 w-4" />
              Novedades de la empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.feed ?? []).length === 0 ? (
              <EmptyState title="Sin publicaciones" />
            ) : (
              (data?.feed ?? []).map((post) => (
                <Link
                  key={post.id}
                  to={`/communication/posts/${post.id}`}
                  className="block rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{post.title}</p>
                    {post.requiresAck ? <Badge tone="warning">Requiere acuse</Badge> : null}
                  </div>
                  {post.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(post.publishedAt)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.recognitions ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4" />
              Reconocimientos recibidos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {(data?.recognitions ?? []).map((recognition) => (
              <div key={recognition.id} className="rounded-md border p-3 text-sm">
                <p>{recognition.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {recognition.from?.fullName ?? 'Anonimo'}
                  {recognition.value ? ` · ${recognition.value.name}` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
