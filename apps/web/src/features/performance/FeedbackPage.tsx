import { feedbackSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Send } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
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
  EmptyState,
  Field,
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

interface FeedbackRow {
  id: string;
  kind: string;
  visibility: string;
  message: string;
  createdAt: string;
  from: { id: string; fullName: string } | null;
  competency: { id: string; name: string } | null;
}

export function FeedbackPage() {
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'feedback'],
    queryFn: () => apiList<FeedbackRow>('/performance/feedback', { limit: 50 }),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback continuo"
        description="Reconocimientos, sugerencias y peticiones de retroalimentacion."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" />
            Dar feedback
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feedback recibido</CardTitle>
          <CardDescription>
            El feedback privado solo lo ve quien lo recibe; el de jefe solo su lider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="Aun no ha recibido feedback" />
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex gap-3 rounded-md border p-3">
                <Avatar name={row.from?.fullName ?? 'Anonimo'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{row.from?.fullName ?? 'Anonimo'}</p>
                    <Badge
                      tone={row.kind === 'praise' ? 'success' : 'info'}
                      className="text-[10px]"
                    >
                      {row.kind === 'praise'
                        ? 'Reconocimiento'
                        : row.kind === 'suggestion'
                          ? 'Sugerencia'
                          : 'General'}
                    </Badge>
                    {row.competency ? (
                      <Badge tone="muted" className="text-[10px]">
                        {row.competency.name}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm">{row.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {relativeTime(row.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <GiveFeedbackDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function GiveFeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    toEmployeeId: '',
    kind: 'praise',
    visibility: 'private',
    message: '',
    competencyId: '',
  });

  const { data: employees } = useQuery({
    queryKey: ['people', 'employees', 'feedback'],
    queryFn: () => apiList<{ id: string; fullName: string }>('/people/employees', { limit: 200 }),
    enabled: open,
    retry: false,
  });

  const { data: competencies } = useQuery({
    queryKey: ['performance', 'competencies'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/performance/competencies'),
    enabled: open,
    retry: false,
  });

  const send = useMutation({
    mutationFn: () =>
      apiPost('/performance/feedback', {
        toEmployeeId: form.toEmployeeId,
        kind: form.kind,
        visibility: form.visibility,
        message: form.message,
        competencyId: form.competencyId || null,
      }),
    onSuccess: () => {
      toast.success('Feedback enviado');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'feedback'] });
      onOpenChange(false);
      setForm({
        toEmployeeId: '',
        kind: 'praise',
        visibility: 'private',
        message: '',
        competencyId: '',
      });
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Para" required>
            <NativeSelect
              value={form.toEmployeeId}
              onChange={(event) => setForm({ ...form, toEmployeeId: event.target.value })}
            >
              <option value="">Seleccione...</option>
              {(employees?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
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
                <option value="praise">Reconocimiento</option>
                <option value="suggestion">Sugerencia</option>
                <option value="general">General</option>
              </NativeSelect>
            </Field>
            <Field label="Visibilidad">
              <NativeSelect
                value={form.visibility}
                onChange={(event) => setForm({ ...form, visibility: event.target.value })}
              >
                <option value="private">Privado (solo la persona)</option>
                <option value="manager_only">Solo su jefe</option>
                <option value="public">Publico</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Competencia relacionada">
            <NativeSelect
              value={form.competencyId}
              onChange={(event) => setForm({ ...form, competencyId: event.target.value })}
            >
              <option value="">Sin competencia</option>
              {(competencies ?? []).map((competency) => (
                <option key={competency.id} value={competency.id}>
                  {competency.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Mensaje" required>
            <Textarea
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              rows={4}
              placeholder="Describa hechos observables y su impacto."
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={send.isPending}
            onClick={() => {
              setError(null);
              const parsed = feedbackSchema.safeParse({
                toEmployeeId: form.toEmployeeId,
                kind: form.kind,
                visibility: form.visibility,
                message: form.message,
                competencyId: form.competencyId || null,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              send.mutate();
            }}
          >
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
