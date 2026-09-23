import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

interface MyRequests {
  leaves: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    requestedDays: string;
    reason: string | null;
    leaveType: { name: string; color: string };
  }>;
  tickets: Array<{
    id: string;
    number: number;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    category: { name: string } | null;
  }>;
  changeRequests: Array<{
    id: string;
    status: string;
    changes: Record<string, unknown>;
    createdAt: string;
    comment: string | null;
  }>;
}

export function MyRequestsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'my-requests'],
    queryFn: () => apiGet<MyRequests>('/portal/my-requests'),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis solicitudes"
        description="Ausencias, tickets y cambios de datos que ha solicitado."
      />

      <Tabs defaultValue="ausencias">
        <TabsList>
          <TabsTrigger value="ausencias">Ausencias ({data?.leaves.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({data?.tickets.length ?? 0})</TabsTrigger>
          <TabsTrigger value="datos">
            Cambios de datos ({data?.changeRequests.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ausencias">
          <Card>
            <CardContent className="space-y-2 p-4">
              {(data?.leaves ?? []).length === 0 ? (
                <EmptyState title="Sin solicitudes de ausencia" />
              ) : (
                data?.leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center gap-3 rounded-md border p-3">
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: leave.leaveType.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{leave.leaveType.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(leave.startDate)} — {formatDate(leave.endDate)} ·{' '}
                        {Number(leave.requestedDays)} dias
                      </p>
                      {leave.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{leave.reason}</p>
                      ) : null}
                    </div>
                    <Badge tone={statusTone(leave.status)}>{statusLabel(leave.status)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardContent className="space-y-2 p-4">
              {(data?.tickets ?? []).length === 0 ? (
                <EmptyState
                  title="Sin tickets"
                  description="Abra un ticket desde el centro de ayuda."
                />
              ) : (
                data?.tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/portal/tickets/${ticket.id}`}
                    className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      #{ticket.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.category?.name ?? 'Sin categoria'} ·{' '}
                        {formatDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cambios que requieren aprobacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.changeRequests ?? []).length === 0 ? (
                <EmptyState title="Sin cambios pendientes" />
              ) : (
                data?.changeRequests.map((request) => (
                  <div key={request.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Solicitud del {formatDate(request.createdAt)}</p>
                      <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {Object.entries(request.changes).map(([field, value]) => (
                        <li key={field}>
                          {field}: <span className="font-medium">{String(value)}</span>
                        </li>
                      ))}
                    </ul>
                    {request.comment ? (
                      <p className="mt-2 text-xs italic text-muted-foreground">{request.comment}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
