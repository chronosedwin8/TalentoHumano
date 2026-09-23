import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
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

interface Template {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  tasks: Array<{
    id: string;
    title: string;
    ownerType: string;
    kind: string;
    offsetDays: number;
    isRequired: boolean;
    position: number;
  }>;
}

interface DraftTask {
  title: string;
  ownerType: string;
  kind: string;
  offsetDays: number;
  isRequired: boolean;
}

const OWNER_LABELS: Record<string, string> = {
  employee: 'Colaborador',
  manager: 'Jefe',
  hr: 'Talento Humano',
  it: 'Tecnologia',
  buddy: 'Buddy',
  other: 'Otro',
};

const KIND_LABELS: Record<string, string> = {
  document: 'Documento',
  form: 'Formulario',
  course: 'Curso',
  meeting: 'Reunion',
  reading: 'Lectura',
  equipment: 'Entrega de equipo',
  system_access: 'Acceso a sistemas',
  generic: 'General',
};

export function OnboardingTemplatesPage() {
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const [kind, setKind] = React.useState<'onboarding' | 'offboarding'>('onboarding');
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'templates', kind],
    queryFn: () => apiGet<Template[]>('/onboarding/templates', { kind }),
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/onboarding')}>
        <ArrowLeft className="h-4 w-4" />
        Volver al tablero
      </Button>

      <PageHeader
        title="Plantillas de ingreso y salida"
        description="Listas de tareas con responsable, tipo y fecha relativa al dia de ingreso."
        actions={
          can('onboarding.template.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          ) : null
        }
      />

      <Tabs value={kind} onValueChange={(value) => setKind(value as 'onboarding' | 'offboarding')}>
        <TabsList>
          <TabsTrigger value="onboarding">Ingreso</TabsTrigger>
          <TabsTrigger value="offboarding">Salida</TabsTrigger>
        </TabsList>

        <TabsContent value={kind}>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data ?? []).length === 0 ? (
            <EmptyState
              title="Sin plantillas"
              description="Cree la primera plantilla del proceso."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data?.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.description ? (
                          <CardDescription>{template.description}</CardDescription>
                        ) : null}
                      </div>
                      {template.isDefault ? <Badge tone="success">Por defecto</Badge> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {template.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {task.offsetDays >= 0
                            ? `Dia +${task.offsetDays}`
                            : `Dia ${task.offsetDays}`}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                        <Badge tone="muted" className="shrink-0 text-[10px]">
                          {OWNER_LABELS[task.ownerType] ?? task.ownerType}
                        </Badge>
                      </div>
                    ))}
                    {template.tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin tareas definidas.</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} defaultKind={kind} />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  defaultKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind: 'onboarding' | 'offboarding';
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [tasks, setTasks] = React.useState<DraftTask[]>([
    { title: '', ownerType: 'hr', kind: 'generic', offsetDays: 0, isRequired: true },
  ]);

  const create = useMutation({
    mutationFn: () =>
      apiPost('/onboarding/templates', {
        name,
        kind: defaultKind,
        description: description || null,
        isDefault: false,
        isActive: true,
        tasks: tasks.filter((task) => task.title.trim()),
      }),
    onSuccess: () => {
      toast.success('Plantilla creada');
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] });
      onOpenChange(false);
      setName('');
      setDescription('');
      setTasks([{ title: '', ownerType: 'hr', kind: 'generic', offsetDays: 0, isRequired: true }]);
    },
    onError: (error: Error) => toast.error('No fue posible crear la plantilla', error.message),
  });

  const patchTask = (index: number, patch: Partial<DraftTask>) =>
    setTasks((current) => current.map((task, i) => (i === index ? { ...task, ...patch } : task)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            Nueva plantilla de {defaultKind === 'onboarding' ? 'ingreso' : 'salida'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Nombre" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Descripcion">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">Tareas</p>
            {tasks.map((task, index) => (
              <div key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-5"
                  value={task.title}
                  onChange={(event) => patchTask(index, { title: event.target.value })}
                  placeholder="Titulo de la tarea"
                />
                <NativeSelect
                  className="sm:col-span-3"
                  value={task.ownerType}
                  onChange={(event) => patchTask(index, { ownerType: event.target.value })}
                >
                  {Object.entries(OWNER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  className="sm:col-span-2"
                  value={task.kind}
                  onChange={(event) => patchTask(index, { kind: event.target.value })}
                >
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  className="sm:col-span-1"
                  type="number"
                  value={task.offsetDays}
                  onChange={(event) => patchTask(index, { offsetDays: Number(event.target.value) })}
                  title="Dias relativos al ingreso"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:col-span-1"
                  onClick={() => setTasks((current) => current.filter((_, i) => i !== index))}
                  aria-label="Eliminar tarea"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setTasks((current) => [
                  ...current,
                  { title: '', ownerType: 'hr', kind: 'generic', offsetDays: 0, isRequired: true },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Agregar tarea
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            Crear plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
