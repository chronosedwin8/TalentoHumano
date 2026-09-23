import { jobPostingSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { ApiRequestError, apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
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

interface JobRow {
  id: string;
  code: string;
  slug: string;
  title: string;
  status: string;
  openings: number;
  workModality: string;
  publishedAt: string | null;
  closesAt: string | null;
  viewCount: number;
  department: { name: string } | null;
  location: { name: string } | null;
  _count: { applications: number };
}

interface Metrics {
  openJobs: number;
  activeApplications: number;
  hiredThisYear: number;
  timeToHireDays: number;
  timeToFillDays: number;
}

export function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'jobs', { page, status, search }],
    queryFn: () => apiList<JobRow>('/recruiting/jobs', { page, limit: 25, status, search }),
  });

  const { data: metrics } = useQuery({
    queryKey: ['recruiting', 'metrics'],
    queryFn: () => apiGet<Metrics>('/recruiting/metrics'),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiPost(`/recruiting/jobs/${id}/publish`),
    onSuccess: () => {
      toast.success('Vacante publicada en el portal de empleos');
      void queryClient.invalidateQueries({ queryKey: ['recruiting'] });
    },
  });

  const columns: Array<Column<JobRow>> = [
    {
      key: 'title',
      header: 'Vacante',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.code} · {row.department?.name ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Sede',
      hideOnMobile: true,
      render: (row) => `${row.location?.name ?? '—'} · ${statusLabel(row.workModality)}`,
    },
    { key: 'openings', header: 'Cupos', hideOnMobile: true },
    {
      key: 'applications',
      header: 'Postulaciones',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {row._count.applications}
        </span>
      ),
    },
    {
      key: 'closesAt',
      header: 'Cierra',
      hideOnMobile: true,
      render: (row) => formatDate(row.closesAt),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'draft' && can('recruiting.job.publish') ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              publish.mutate(row.id);
            }}
          >
            Publicar
          </Button>
        ) : row.status === 'published' ? (
          <a
            href={`/careers/${user?.company?.slug}/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver publicacion
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacantes"
        description="Requisiciones, publicacion y seguimiento de candidatos por etapas."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/recruiting/requisiciones">
                <FileText className="h-4 w-4" />
                Requisiciones
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/recruiting/candidatos">
                <Users className="h-4 w-4" />
                Banco de candidatos
              </Link>
            </Button>
            {can('recruiting.job.create') ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva vacante
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Vacantes abiertas" value={metrics?.openJobs ?? 0} />
        <StatCard label="Postulaciones activas" value={metrics?.activeApplications ?? 0} />
        <StatCard label="Contrataciones del ano" value={metrics?.hiredThisYear ?? 0} />
        <StatCard label="Time to hire" value={`${metrics?.timeToHireDays ?? 0} d`} />
        <StatCard label="Time to fill" value={`${metrics?.timeToFillDays ?? 0} d`} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Buscar vacante"
        onRowClick={(row) => navigate(`/recruiting/jobs/${row.id}`)}
        emptyTitle="Sin vacantes"
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">Todas</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicadas</option>
            <option value="closed">Cerradas</option>
          </NativeSelect>
        }
      />

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState<Record<string, any>>({
    title: '',
    description: '',
    requirements: '',
    openings: 1,
    workModality: 'onsite',
    salaryVisible: false,
  });

  const { data: options } = useQuery({
    queryKey: ['organization', 'options'],
    queryFn: async () => {
      const [departments, positions, locations] = await Promise.all([
        apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
        apiGet<Array<{ id: string; name: string }>>('/organization/positions'),
        apiGet<Array<{ id: string; name: string }>>('/organization/locations'),
      ]);
      return { departments, positions, locations };
    },
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>('/recruiting/jobs', payload),
    onSuccess: (job) => {
      toast.success('Vacante creada', 'Se genero el pipeline por defecto.');
      void queryClient.invalidateQueries({ queryKey: ['recruiting'] });
      onOpenChange(false);
      navigate(`/recruiting/jobs/${job.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error('No fue posible crear la vacante', error.message);
    },
  });

  const submit = () => {
    setErrors({});
    const payload = {
      ...form,
      openings: Number(form.openings),
      competencyIds: [],
    };
    const parsed = jobPostingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nueva vacante</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titulo" required error={errors.title} className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Cargo">
            <NativeSelect
              value={form.positionId ?? ''}
              onChange={(event) =>
                setForm({ ...form, positionId: event.target.value || undefined })
              }
            >
              <option value="">Sin asignar</option>
              {(options?.positions ?? []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Area">
            <NativeSelect
              value={form.departmentId ?? ''}
              onChange={(event) =>
                setForm({ ...form, departmentId: event.target.value || undefined })
              }
            >
              <option value="">Sin asignar</option>
              {(options?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sede">
            <NativeSelect
              value={form.locationId ?? ''}
              onChange={(event) =>
                setForm({ ...form, locationId: event.target.value || undefined })
              }
            >
              <option value="">Sin asignar</option>
              {(options?.locations ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Modalidad">
            <NativeSelect
              value={form.workModality}
              onChange={(event) => setForm({ ...form, workModality: event.target.value })}
            >
              <option value="onsite">Presencial</option>
              <option value="hybrid">Hibrida</option>
              <option value="remote">Remota</option>
            </NativeSelect>
          </Field>
          <Field label="Numero de cupos">
            <Input
              type="number"
              min={1}
              value={form.openings}
              onChange={(event) => setForm({ ...form, openings: event.target.value })}
            />
          </Field>
          <Field label="Fecha limite">
            <Input
              type="date"
              value={form.closesAt ?? ''}
              onChange={(event) => setForm({ ...form, closesAt: event.target.value || undefined })}
            />
          </Field>
          <Field label="Descripcion" required error={errors.description} className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={4}
            />
          </Field>
          <Field label="Requisitos" className="sm:col-span-2">
            <Textarea
              value={form.requirements}
              onChange={(event) => setForm({ ...form, requirements: event.target.value })}
              rows={3}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Crear vacante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
