import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '@/components/charts';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  debounce,
  formatNumber,
  formatPercent,
  relativeTime,
  statusLabel,
  statusTone,
} from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  StatCard,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface TicketRow {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  slaBreached: boolean;
  dueAt: string | null;
  createdAt: string;
  category: { id: string; name: string } | null;
  requester: { id: string; fullName: string } | null;
  assignee: { id: string; fullName: string } | null;
}

interface Metrics {
  backlog: number;
  byStatus: Array<{ label: string; value: number }>;
  byCategory: Array<{ label: string; value: number }>;
  firstResponseHours: number;
  resolutionHours: number;
  slaCompliance: number;
  csat: number;
  csatResponses: number;
}

const PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function TicketsPage() {
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [mine, setMine] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const pushSearch = React.useMemo(
    () =>
      debounce((value: string) => {
        setDebounced(value);
        setPage(1);
      }, 350),
    [],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['helpdesk', 'tickets', { page, status, priority, mine, debounced }],
    queryFn: () =>
      apiList<TicketRow>('/helpdesk/tickets', {
        page,
        limit: 25,
        status,
        priority,
        search: debounced,
        mine: mine ? 'true' : '',
      }),
  });

  const { data: metrics } = useQuery({
    queryKey: ['helpdesk', 'metrics'],
    queryFn: () => apiGet<Metrics>('/helpdesk/metrics'),
    retry: false,
  });

  const columns: Array<Column<TicketRow>> = [
    {
      key: 'number',
      header: '#',
      render: (row) => <span className="font-mono text-xs">#{row.number}</span>,
    },
    {
      key: 'subject',
      header: 'Asunto',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.category?.name ?? 'Sin categoria'}
            {row.requester ? ` · ${row.requester.fullName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Prioridad',
      hideOnMobile: true,
      render: (row) => <Badge tone={statusTone(row.priority)}>{statusLabel(row.priority)}</Badge>,
    },
    {
      key: 'assignee',
      header: 'Responsable',
      hideOnMobile: true,
      render: (row) =>
        row.assignee?.fullName ?? <span className="text-muted-foreground">Sin asignar</span>,
    },
    {
      key: 'dueAt',
      header: 'SLA',
      hideOnMobile: true,
      render: (row) =>
        row.slaBreached ? (
          <Badge tone="danger">Incumplido</Badge>
        ) : row.dueAt ? (
          <span className="text-xs text-muted-foreground">vence {relativeTime(row.dueAt)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      hideOnMobile: true,
      render: (row) => relativeTime(row.createdAt),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Tickets del colaborador con SLA, categorias y base de conocimiento."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        }
      />

      {metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tickets abiertos" value={metrics.backlog} />
            <StatCard
              label="Cumplimiento de SLA"
              value={formatPercent(metrics.slaCompliance)}
              tone={
                metrics.slaCompliance >= 90
                  ? 'success'
                  : metrics.slaCompliance >= 75
                    ? 'warning'
                    : 'danger'
              }
            />
            <StatCard
              label="Primera respuesta"
              value={`${formatNumber(metrics.firstResponseHours, 1)} h`}
              hint="Promedio"
            />
            <StatCard
              label="Satisfaccion (CSAT)"
              value={metrics.csatResponses ? `${formatNumber(metrics.csat, 2)} / 5` : 'Sin datos'}
              hint={`${metrics.csatResponses} calificaciones`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tickets por categoria</CardTitle>
                <CardDescription>Donde se concentra la demanda del equipo.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart data={metrics.byCategory} height={220} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tickets por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={metrics.byStatus.map((row) => ({
                    label: statusLabel(row.label),
                    value: row.value,
                  }))}
                  height={220}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/helpdesk/tickets/${row.id}`)}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          pushSearch(value);
        }}
        searchPlaceholder="Buscar por asunto"
        emptyTitle="Sin tickets"
        emptyDescription="Cree un ticket para pedir apoyo al area de talento humano."
        toolbar={
          <>
            <NativeSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Todos los estados</option>
              <option value="new">Nuevos</option>
              <option value="open">Abiertos</option>
              <option value="pending_requester">Esperan al solicitante</option>
              <option value="on_hold">En espera</option>
              <option value="resolved">Resueltos</option>
              <option value="closed">Cerrados</option>
            </NativeSelect>
            <NativeSelect
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
              className="w-36"
            >
              <option value="">Prioridad</option>
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
            {can('helpdesk.ticket.assign') ? (
              <Button
                variant={mine ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMine(!mine)}
              >
                <LifeBuoy className="h-4 w-4" />
                Solo mios
              </Button>
            ) : null}
          </>
        }
      />

      {creating ? <CreateTicketDialog open onOpenChange={() => setCreating(false)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CreateTicketDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    subject: '',
    description: '',
    priority: 'normal',
    categoryId: '',
  });
  const [suggestQuery, setSuggestQuery] = React.useState('');

  const pushSuggest = React.useMemo(
    () => debounce((value: string) => setSuggestQuery(value), 500),
    [],
  );

  const { data: categories } = useQuery({
    queryKey: ['helpdesk', 'categories'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/helpdesk/categories'),
  });

  // Deflection: suggest knowledge base articles before the ticket is created.
  const { data: suggestions } = useQuery({
    queryKey: ['helpdesk', 'kb', 'suggest', suggestQuery],
    queryFn: () =>
      apiGet<Array<{ id: string; title: string; summary: string | null }>>('/helpdesk/kb/suggest', {
        q: suggestQuery,
      }),
    enabled: suggestQuery.trim().length > 3,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string; number: number }>('/helpdesk/tickets', {
        ...form,
        categoryId: form.categoryId || null,
        fileIds: [],
      }),
    onSuccess: (ticket) => {
      toast.success(`Ticket #${ticket.number} creado`);
      void queryClient.invalidateQueries({ queryKey: ['helpdesk'] });
      onOpenChange(false);
      navigate(`/helpdesk/tickets/${ticket.id}`);
    },
    onError: (error: Error) => toast.error('No fue posible crear el ticket', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Asunto" required>
            <Input
              value={form.subject}
              onChange={(event) => {
                setForm({ ...form, subject: event.target.value });
                pushSuggest(event.target.value);
              }}
              placeholder="Resuma su solicitud en una linea"
            />
          </Field>

          {suggestions?.length ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4" />
                  Quiza esto resuelva su duda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {suggestions.slice(0, 3).map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/helpdesk/conocimiento');
                    }}
                    className="block w-full rounded-md p-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{article.title}</span>
                    {article.summary ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {article.summary}
                      </span>
                    ) : null}
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <NativeSelect
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Sin categoria</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Prioridad">
              <NativeSelect
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Descripcion" required>
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={5}
              placeholder="Cuentenos que necesita y desde cuando"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.subject.trim().length < 3 || form.description.trim().length < 3}
            onClick={() => create.mutate()}
          >
            Crear ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
