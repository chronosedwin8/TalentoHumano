import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, FilePlus2, Pencil, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { statusLabel, statusTone } from '@/lib/utils';
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
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';

interface CourseDetail {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  status: string;
  estimatedMinutes: number;
  isMandatory: boolean;
  modules: Array<{
    id: string;
    title: string;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      kind: string;
      estimatedMinutes: number;
      isRequired: boolean;
      content: { version: number; isPublished: boolean; updatedAt: string } | null;
    }>;
  }>;
}

export function CourseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const [moduleOpen, setModuleOpen] = React.useState(false);
  const [lessonFor, setLessonFor] = React.useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'course', id],
    queryFn: () => apiGet<CourseDetail>(`/learning/courses/${id}`),
    enabled: Boolean(id),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['learning', 'course', id, 'enrollments'],
    queryFn: () => apiList<any>('/learning/enrollments', { courseId: id, limit: 50 }),
    enabled: Boolean(id) && can('learning.enrollment.read'),
    retry: false,
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const canEdit = can('learning.lesson.update');

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/learning/catalogo')}>
        <ArrowLeft className="h-4 w-4" />
        Volver al catalogo
      </Button>

      <PageHeader
        title={data.title}
        description={`${data.category ?? 'General'} · ${data.estimatedMinutes} min`}
        actions={
          <>
            <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
            {data.isMandatory ? <Badge tone="warning">Obligatorio</Badge> : null}
            {can('learning.enrollment.create') ? (
              <Button variant="outline" onClick={() => setEnrollOpen(true)}>
                <Users className="h-4 w-4" />
                Inscribir
              </Button>
            ) : null}
            {canEdit ? (
              <Button onClick={() => setModuleOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo modulo
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="contenido">
        <TabsList>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="inscritos">Inscritos</TabsTrigger>
        </TabsList>

        <TabsContent value="contenido">
          <div className="space-y-4">
            {data.summary ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {data.summary}
                </CardContent>
              </Card>
            ) : null}

            {data.modules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Modulo {module.position + 1}: {module.title}
                    </CardTitle>
                    {canEdit ? (
                      <Button variant="outline" size="sm" onClick={() => setLessonFor(module.id)}>
                        <FilePlus2 className="h-4 w-4" />
                        Agregar leccion
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {module.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {lesson.estimatedMinutes} min ·{' '}
                          {lesson.content?.isPublished
                            ? `version ${lesson.content.version} publicada`
                            : 'sin publicar'}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/learning/lecciones/${lesson.id}`}>Ver</Link>
                      </Button>
                      {canEdit ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/learning/lecciones/${lesson.id}/editar`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {module.lessons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin lecciones en este modulo.</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}

            {data.modules.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  El curso aun no tiene modulos.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="inscritos">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Colaboradores inscritos ({enrollments?.meta?.total ?? 0})
              </CardTitle>
              <CardDescription>Progreso y calificaciones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(enrollments?.data ?? []).map((enrollment: any) => (
                <div
                  key={enrollment.id}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{enrollment.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {enrollment.employee.employeeCode}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">{enrollment.progress}%</span>
                  <Badge tone={statusTone(enrollment.status)}>
                    {statusLabel(enrollment.status)}
                  </Badge>
                </div>
              ))}
              {(enrollments?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin inscritos todavia.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ModuleDialog open={moduleOpen} onOpenChange={setModuleOpen} courseId={id} />
      <LessonDialog moduleId={lessonFor} onClose={() => setLessonFor(null)} courseId={id} />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} courseId={id} />
    </div>
  );
}

function ModuleDialog({
  open,
  onOpenChange,
  courseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState('');

  const create = useMutation({
    mutationFn: () => apiPost('/learning/modules', { courseId, title, position: 0 }),
    onSuccess: () => {
      toast.success('Modulo creado');
      void queryClient.invalidateQueries({ queryKey: ['learning', 'course', courseId] });
      onOpenChange(false);
      setTitle('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nuevo modulo</DialogTitle>
        </DialogHeader>
        <Field label="Titulo" required>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!title.trim()}
            onClick={() => create.mutate()}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonDialog({
  moduleId,
  onClose,
  courseId,
}: {
  moduleId: string | null;
  onClose: () => void;
  courseId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = React.useState('');
  const [minutes, setMinutes] = React.useState(10);

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/learning/lessons', {
        moduleId,
        title,
        kind: 'content',
        estimatedMinutes: Number(minutes),
        isRequired: true,
        position: 0,
      }),
    onSuccess: (lesson) => {
      toast.success('Leccion creada');
      void queryClient.invalidateQueries({ queryKey: ['learning', 'course', courseId] });
      onClose();
      setTitle('');
      navigate(`/learning/lecciones/${lesson.id}/editar`);
    },
  });

  return (
    <Dialog open={Boolean(moduleId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nueva leccion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Duracion estimada (min)">
            <Input
              type="number"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!title.trim()}
            onClick={() => create.mutate()}
          >
            Crear y editar contenido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollDialog({
  open,
  onOpenChange,
  courseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState('');
  const [search, setSearch] = React.useState('');

  const { data: employees } = useQuery({
    queryKey: ['people', 'employees', 'enroll', search],
    queryFn: () => apiList<any>('/people/employees', { limit: 100, search, status: 'active' }),
    enabled: open,
    retry: false,
  });

  const enroll = useMutation({
    mutationFn: () =>
      apiPost('/learning/enrollments', {
        courseId,
        employeeIds: selected,
        dueDate: dueDate || null,
        source: 'manual',
      }),
    onSuccess: () => {
      toast.success('Colaboradores inscritos');
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
      onOpenChange(false);
      setSelected([]);
    },
    onError: (error: Error) => toast.error('No fue posible inscribir', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Inscribir colaboradores</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Buscar">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} />
            </Field>
            <Field label="Fecha limite">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
            {(employees?.data ?? []).map((employee: any) => (
              <label
                key={employee.id}
                className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(employee.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, employee.id]
                        : current.filter((id) => id !== employee.id),
                    )
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <span className="min-w-0 flex-1 truncate">{employee.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {employee.department?.name ?? '—'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selected.length} seleccionados</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={enroll.isPending}
            disabled={!selected.length}
            onClick={() => enroll.mutate()}
          >
            Inscribir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
