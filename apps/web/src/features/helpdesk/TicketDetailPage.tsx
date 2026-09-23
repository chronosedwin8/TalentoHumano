import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, EyeOff, Lock, Send, Star, UserPlus } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDateTime, relativeTime, statusLabel, statusTone } from '@/lib/utils';
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
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface TicketDetail {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  slaBreached: boolean;
  dueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assigneeEmployeeId: string | null;
  category: { id: string; name: string } | null;
  requester: { id: string; fullName: string; email: string } | null;
  assignee: { id: string; fullName: string } | null;
  messages: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    authorUserId: string | null;
    createdAt: string;
  }>;
  csat: { rating: number; comment: string | null } | null;
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const [body, setBody] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [rating, setRating] = React.useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['helpdesk', 'ticket', id],
    queryFn: () => apiGet<TicketDetail>(`/helpdesk/tickets/${id}`),
    enabled: Boolean(id),
  });

  const { data: macros } = useQuery({
    queryKey: ['helpdesk', 'macros'],
    queryFn: () => apiGet<Array<{ id: string; name: string; body: string }>>('/helpdesk/macros'),
    enabled: can('helpdesk.ticket.update'),
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['helpdesk'] });
  };

  const reply = useMutation({
    mutationFn: () =>
      apiPost(`/helpdesk/tickets/${id}/messages`, { body, isInternal, fileIds: [] }),
    onSuccess: () => {
      setBody('');
      setIsInternal(false);
      invalidate();
    },
    onError: (error: Error) => toast.error('No fue posible enviar el mensaje', error.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => apiPatch(`/helpdesk/tickets/${id}`, { status }),
    onSuccess: () => {
      toast.success('Ticket actualizado');
      invalidate();
    },
    onError: (error: Error) => toast.error('No fue posible actualizar', error.message),
  });

  const rate = useMutation({
    mutationFn: (value: number) => apiPost(`/helpdesk/tickets/${id}/csat`, { rating: value }),
    onSuccess: () => {
      toast.success('Gracias por calificar la atencion');
      invalidate();
    },
    onError: (error: Error) => toast.error('No fue posible calificar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const isAgent = can('helpdesk.ticket.update');
  const isRequester = data.requester?.id === user?.employee?.id;
  const canRate =
    isRequester && (data.status === 'resolved' || data.status === 'closed') && !data.csat;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/helpdesk')}>
        <ArrowLeft className="h-4 w-4" />
        Volver a la bandeja
      </Button>

      <PageHeader
        title={data.subject}
        description={`Ticket #${data.number} · abierto ${relativeTime(data.createdAt)}`}
        actions={
          <>
            <Badge tone={statusTone(data.priority)}>{statusLabel(data.priority)}</Badge>
            <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
            {isAgent ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setAssigning(true)}>
                  <UserPlus className="h-4 w-4" />
                  Asignar
                </Button>
                {data.status !== 'closed' && can('helpdesk.ticket.close') ? (
                  <Button size="sm" onClick={() => setClosing(true)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Resolver
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Solicitud original</CardTitle>
              <CardDescription>
                {data.requester?.fullName ?? 'Solicitante'} · {formatDateTime(data.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{data.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin respuestas todavia.</p>
              ) : (
                data.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'rounded-md border p-3 text-sm',
                      message.isInternal ? 'border-amber-500/40 bg-amber-500/5' : 'bg-muted/30',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {message.isInternal ? (
                        <span className="flex items-center gap-1 font-medium text-amber-600">
                          <EyeOff className="h-3.5 w-3.5" />
                          Nota interna
                        </span>
                      ) : null}
                      <span>{formatDateTime(message.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))
              )}

              {data.status !== 'closed' ? (
                <div className="space-y-2 border-t pt-3">
                  {isAgent && macros?.length ? (
                    <NativeSelect
                      value=""
                      onChange={(event) => {
                        const macro = macros.find((item) => item.id === event.target.value);
                        if (macro) setBody(macro.body);
                      }}
                      className="w-full sm:w-64"
                    >
                      <option value="">Insertar macro de respuesta...</option>
                      {macros.map((macro) => (
                        <option key={macro.id} value={macro.id}>
                          {macro.name}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={4}
                    placeholder="Escriba su respuesta"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      loading={reply.isPending}
                      disabled={!body.trim()}
                      onClick={() => reply.mutate()}
                    >
                      <Send className="h-4 w-4" />
                      Responder
                    </Button>
                    {isAgent ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isInternal}
                          onCheckedChange={(checked) => setIsInternal(checked === true)}
                        />
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" />
                          Nota interna (no visible para el solicitante)
                        </span>
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canRate ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">¿Como le parecio la atencion?</CardTitle>
                <CardDescription>
                  Su calificacion alimenta el indicador CSAT del area.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onMouseEnter={() => setRating(value)}
                    onClick={() => rate.mutate(value)}
                    className="p-1"
                    aria-label={`${value} de 5`}
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                      )}
                    />
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : data.csat ? (
            <Card>
              <CardContent className="flex items-center gap-2 p-4 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Calificado con {data.csat.rating} de 5
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Categoria" value={data.category?.name ?? '—'} />
              <Row
                label="Responsable"
                value={
                  data.assignee ? (
                    <span className="flex items-center justify-end gap-1.5">
                      <Avatar name={data.assignee.fullName} className="h-5 w-5 text-[10px]" />
                      {data.assignee.fullName}
                    </span>
                  ) : (
                    'Sin asignar'
                  )
                }
              />
              <Row
                label="SLA"
                value={
                  data.slaBreached ? (
                    <Badge tone="danger">Incumplido</Badge>
                  ) : data.dueAt ? (
                    `vence ${relativeTime(data.dueAt)}`
                  ) : (
                    '—'
                  )
                }
              />
              <Row
                label="Primera respuesta"
                value={data.firstResponseAt ? relativeTime(data.firstResponseAt) : 'Pendiente'}
              />
              <Row
                label="Resuelto"
                value={data.resolvedAt ? formatDateTime(data.resolvedAt) : '—'}
              />
            </CardContent>
          </Card>

          {isAgent ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cambiar estado</CardTitle>
              </CardHeader>
              <CardContent>
                <NativeSelect
                  value={data.status}
                  onChange={(event) => changeStatus.mutate(event.target.value)}
                >
                  <option value="new">Nuevo</option>
                  <option value="open">Abierto</option>
                  <option value="pending_requester">Espera al solicitante</option>
                  <option value="on_hold">En espera</option>
                  <option value="resolved">Resuelto</option>
                  <option value="closed">Cerrado</option>
                </NativeSelect>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {closing ? <CloseDialog open onOpenChange={() => setClosing(false)} ticketId={id} /> : null}
      {assigning ? (
        <AssignDialog open onOpenChange={() => setAssigning(false)} ticketId={id} />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CloseDialog({
  open,
  onOpenChange,
  ticketId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = React.useState('');

  const close = useMutation({
    mutationFn: () =>
      apiPost(`/helpdesk/tickets/${ticketId}/close`, { resolutionNote: note || null }),
    onSuccess: () => {
      toast.success('Ticket resuelto', 'Se invito al solicitante a calificar la atencion.');
      void queryClient.invalidateQueries({ queryKey: ['helpdesk'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible resolver', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver ticket</DialogTitle>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Nota de resolucion que vera el solicitante"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={close.isPending} onClick={() => close.mutate()}>
            Resolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  ticketId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');

  const { data: employees } = useQuery({
    queryKey: ['people', 'picker', search],
    queryFn: () =>
      apiList<{
        id: string;
        fullName: string;
        position: { id: string; name: string } | null;
      }>('/people/employees', {
        search,
        limit: 15,
        status: 'active',
      }),
  });

  const assign = useMutation({
    mutationFn: (assigneeEmployeeId: string) =>
      apiPost(`/helpdesk/tickets/${ticketId}/assign`, { assigneeEmployeeId }),
    onSuccess: () => {
      toast.success('Ticket asignado');
      void queryClient.invalidateQueries({ queryKey: ['helpdesk'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible asignar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar ticket</DialogTitle>
        </DialogHeader>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar agente"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(employees?.data ?? []).map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => assign.mutate(employee.id)}
              className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
            >
              <Avatar name={employee.fullName} className="h-7 w-7 text-xs" />
              <span className="min-w-0 flex-1 truncate">
                {employee.fullName}
                <span className="ml-2 text-xs text-muted-foreground">
                  {employee.position?.name ?? ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
