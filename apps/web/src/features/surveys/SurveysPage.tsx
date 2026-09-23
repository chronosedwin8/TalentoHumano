import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardList, Plus, Send } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
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
} from '@/components/ui/overlays';

interface SurveyRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  isAnonymous: boolean;
  minSegmentResponses: number;
  opensAt: string | null;
  closesAt: string | null;
  _count: { invitations: number; responses: number };
}

interface MySurvey {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  closesAt: string | null;
  isAnonymous: boolean;
  invitationId: string;
  token: string;
}

export function SurveysPage() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: mine } = useQuery({
    queryKey: ['surveys', 'mine'],
    queryFn: () => apiGet<MySurvey[]>('/surveys/mine'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['surveys', 'list'],
    queryFn: () => apiList<SurveyRow>('/surveys', { limit: 50 }),
    enabled: can('surveys.survey.read'),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: (surveyId: string) => apiPost(`/surveys/${surveyId}/publish`, {}),
    onSuccess: (result: any) => {
      toast.success('Encuesta publicada', `${result.invitations} invitaciones enviadas.`);
      void queryClient.invalidateQueries({ queryKey: ['surveys'] });
    },
    onError: (error: Error) => toast.error('No fue posible publicar', error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encuestas y clima"
        description="Encuestas anonimas con umbral minimo de respuestas por segmento."
        actions={
          can('surveys.survey.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva encuesta
            </Button>
          ) : null
        }
      />

      {(mine ?? []).length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm">Encuestas pendientes de responder</CardTitle>
            <CardDescription>
              Sus respuestas son anonimas y se analizan de forma agregada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mine?.map((survey) => (
              <div
                key={survey.id}
                className="flex items-center gap-3 rounded-md border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{survey.title}</p>
                  {survey.closesAt ? (
                    <p className="text-xs text-muted-foreground">
                      Cierra {formatDate(survey.closesAt)}
                    </p>
                  ) : null}
                </div>
                <Button asChild size="sm">
                  <Link to={`/surveys/${survey.id}/responder`}>Responder</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {can('surveys.survey.read') ? (
        isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (data?.data ?? []).length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin encuestas" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data?.data.map((survey) => (
              <Card key={survey.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{survey.title}</CardTitle>
                      {survey.description ? (
                        <CardDescription className="line-clamp-2">
                          {survey.description}
                        </CardDescription>
                      ) : null}
                    </div>
                    <Badge tone={statusTone(survey.status)}>{statusLabel(survey.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge tone="muted">{survey.kind}</Badge>
                    {survey.isAnonymous ? <Badge tone="info">Anonima</Badge> : null}
                    <Badge tone="muted">Umbral {survey.minSegmentResponses}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {survey._count.responses} de {survey._count.invitations} respuestas
                    {survey._count.invitations
                      ? ` (${Math.round((survey._count.responses / survey._count.invitations) * 100)}%)`
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {survey.status === 'draft' && can('surveys.survey.publish') ? (
                      <Button
                        size="sm"
                        loading={publish.isPending}
                        onClick={() => publish.mutate(survey.id)}
                      >
                        <Send className="h-4 w-4" />
                        Publicar
                      </Button>
                    ) : null}
                    {can('surveys.result.read') ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/surveys/${survey.id}/resultados`}>
                          <BarChart3 className="h-4 w-4" />
                          Resultados
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}

      <CreateSurveyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateSurveyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    kind: 'climate',
    isAnonymous: true,
    minSegmentResponses: 5,
    closesAt: '',
    templateKey: 'clima_laboral',
  });

  const { data: templates } = useQuery({
    queryKey: ['surveys', 'templates'],
    queryFn: () =>
      apiGet<Array<{ id: string; key: string; name: string; schema: any }>>(
        '/surveys/templates/all',
      ),
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => {
      const template = (templates ?? []).find((item) => item.key === form.templateKey);
      return apiPost('/surveys', {
        title: form.title,
        description: form.description || null,
        kind: form.kind,
        isAnonymous: form.isAnonymous,
        minSegmentResponses: Number(form.minSegmentResponses),
        closesAt: form.closesAt || null,
        reminderDays: [3, 7],
        schema: template?.schema ?? { title: form.title, fields: [] },
        audiences: [{ targetType: 'all', filters: {} }],
      });
    },
    onSuccess: () => {
      toast.success('Encuesta creada', 'Publiquela para enviar las invitaciones.');
      void queryClient.invalidateQueries({ queryKey: ['surveys'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear la encuesta', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva encuesta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo" required>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Plantilla de preguntas">
            <NativeSelect
              value={form.templateKey}
              onChange={(event) => setForm({ ...form, templateKey: event.target.value })}
            >
              {(templates ?? []).map((template) => (
                <option key={template.id} value={template.key}>
                  {template.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value })}
              >
                <option value="climate">Clima laboral</option>
                <option value="enps">eNPS</option>
                <option value="pulse">Pulso</option>
                <option value="onboarding">Experiencia de ingreso</option>
                <option value="exit">Salida</option>
                <option value="custom">Personalizada</option>
              </NativeSelect>
            </Field>
            <Field label="Cierra el">
              <Input
                type="date"
                value={form.closesAt}
                onChange={(event) => setForm({ ...form, closesAt: event.target.value })}
              />
            </Field>
            <Field
              label="Umbral minimo por segmento"
              hint="Los segmentos con menos respuestas no se muestran"
            >
              <Input
                type="number"
                min={1}
                value={form.minSegmentResponses}
                onChange={(event) =>
                  setForm({ ...form, minSegmentResponses: Number(event.target.value) })
                }
              />
            </Field>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(event) => setForm({ ...form, isAnonymous: event.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Encuesta anonima
            </label>
          </div>
          <Field label="Descripcion">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={2}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.title.trim()}
            onClick={() => create.mutate()}
          >
            Crear encuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
