import { courseSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPercent, statusLabel, statusTone } from '@/lib/utils';
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

interface CourseRow {
  id: string;
  title: string;
  category: string | null;
  status: string;
  estimatedMinutes: number;
  isMandatory: boolean;
  recertificationMonths: number | null;
  _count: { enrollments: number; modules: number };
}

interface Metrics {
  enrollments: number;
  completionRate: number;
  mandatoryCompliance: number;
  averageScore: number;
  hoursPerEmployee: number;
}

export function CoursesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'courses', { page, status, search }],
    queryFn: () => apiList<CourseRow>('/learning/courses', { page, limit: 25, status, search }),
  });

  const { data: metrics } = useQuery({
    queryKey: ['learning', 'metrics'],
    queryFn: () => apiGet<Metrics>('/learning/metrics'),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiPost(`/learning/courses/${id}/publish`),
    onSuccess: () => {
      toast.success('Curso publicado');
      void queryClient.invalidateQueries({ queryKey: ['learning', 'courses'] });
    },
  });

  const columns: Array<Column<CourseRow>> = [
    {
      key: 'title',
      header: 'Curso',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">{row.category ?? 'General'}</p>
        </div>
      ),
    },
    {
      key: 'modules',
      header: 'Modulos',
      hideOnMobile: true,
      render: (row) => row._count.modules,
    },
    {
      key: 'enrollments',
      header: 'Inscritos',
      render: (row) => row._count.enrollments,
    },
    {
      key: 'estimatedMinutes',
      header: 'Duracion',
      hideOnMobile: true,
      render: (row) => `${row.estimatedMinutes} min`,
    },
    {
      key: 'isMandatory',
      header: 'Tipo',
      hideOnMobile: true,
      render: (row) =>
        row.isMandatory ? (
          <Badge tone="warning">
            Obligatorio
            {row.recertificationMonths ? ` · recert. ${row.recertificationMonths}m` : ''}
          </Badge>
        ) : (
          <Badge tone="muted">Opcional</Badge>
        ),
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
        row.status === 'draft' && can('learning.course.publish') ? (
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
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogo de cursos"
        description="Cursos internos y externos, con editor de contenido por bloques."
        actions={
          can('learning.course.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo curso
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inscripciones" value={metrics?.enrollments ?? 0} />
        <StatCard
          label="Tasa de finalizacion"
          value={formatPercent(metrics?.completionRate ?? 0)}
        />
        <StatCard
          label="Cumplimiento obligatorio"
          value={formatPercent(metrics?.mandatoryCompliance ?? 0)}
        />
        <StatCard label="Horas por colaborador" value={`${metrics?.hoursPerEmployee ?? 0} h`} />
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
        searchPlaceholder="Buscar curso"
        onRowClick={(row) => navigate(`/learning/courses/${row.id}`)}
        emptyTitle="Sin cursos"
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">Todos</option>
            <option value="draft">Borradores</option>
            <option value="published">Publicados</option>
            <option value="archived">Archivados</option>
          </NativeSelect>
        }
      />

      <CreateCourseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateCourseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, any>>({
    title: '',
    summary: '',
    category: '',
    kind: 'internal',
    estimatedMinutes: 60,
    isMandatory: false,
    passingScore: 70,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>('/learning/courses', payload),
    onSuccess: (course) => {
      toast.success('Curso creado');
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
      onOpenChange(false);
      navigate(`/learning/courses/${course.id}`);
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo curso</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titulo" required className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="SST, Liderazgo, Cumplimiento..."
            />
          </Field>
          <Field label="Tipo">
            <NativeSelect
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}
            >
              <option value="internal">Interno</option>
              <option value="external">Externo</option>
            </NativeSelect>
          </Field>
          <Field label="Duracion estimada (min)">
            <Input
              type="number"
              value={form.estimatedMinutes}
              onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
            />
          </Field>
          <Field label="Nota minima de aprobacion">
            <Input
              type="number"
              value={form.passingScore}
              onChange={(event) => setForm({ ...form, passingScore: event.target.value })}
            />
          </Field>
          <Field label="Resumen" className="sm:col-span-2">
            <Textarea
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              rows={3}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isMandatory}
              onChange={(event) => setForm({ ...form, isMandatory: event.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Curso obligatorio para todos los colaboradores
          </label>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              setError(null);
              const parsed = courseSchema.safeParse({
                ...form,
                estimatedMinutes: Number(form.estimatedMinutes),
                passingScore: Number(form.passingScore),
                category: form.category || null,
                summary: form.summary || null,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              create.mutate(parsed.data);
            }}
          >
            Crear curso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
