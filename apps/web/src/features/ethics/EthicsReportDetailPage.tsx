import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderOpen, Lock, Send } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
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

interface ReportDetail {
  id: string;
  trackingCode: string;
  subject: string;
  description: string;
  involvedPersons: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  isAnonymous: boolean;
  relationship: string;
  status: string;
  severity: string;
  occurredAt: string | null;
  createdAt: string;
  dueAt: string | null;
  category: { id: string; name: string; slaDays: number } | null;
  messages: Array<{ id: string; authorKind: string; body: string; createdAt: string }>;
  ethicsCase: {
    id: string;
    caseNumber: string;
    status: string;
    investigationPlan: string | null;
    conclusions: string | null;
    measures: string | null;
    actions: Array<{
      id: string;
      kind: string;
      title: string;
      detail: string | null;
      status: string;
    }>;
  } | null;
}

export function EthicsReportDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = React.useState('');
  const [openCase, setOpenCase] = React.useState(false);
  const [closeCase, setCloseCase] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ethics', 'report', id],
    queryFn: () => apiGet<ReportDetail>(`/ethics/reports/${id}`),
    enabled: Boolean(id),
  });

  const sendReply = useMutation({
    mutationFn: () => apiPost(`/ethics/reports/${id}/reply`, { message: reply }),
    onSuccess: () => {
      toast.success('Mensaje enviado al denunciante');
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['ethics', 'report', id] });
    },
    onError: (error: Error) => toast.error('No fue posible enviar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/ethics')}>
        <ArrowLeft className="h-4 w-4" />
        Volver al canal
      </Button>

      <PageHeader
        title={data.subject}
        description={`Codigo ${data.trackingCode} · recibida ${formatDate(data.createdAt)}`}
        actions={
          <>
            <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
            <Badge tone={statusTone(data.severity)}>{statusLabel(data.severity)}</Badge>
            {!data.ethicsCase ? (
              <Button onClick={() => setOpenCase(true)}>
                <FolderOpen className="h-4 w-4" />
                Abrir caso
              </Button>
            ) : data.ethicsCase.status !== 'closed' ? (
              <Button variant="outline" onClick={() => setCloseCase(true)}>
                Cerrar caso
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contenido de la denuncia</CardTitle>
              <CardDescription>Descifrado unicamente para el oficial de etica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{data.description}</p>
              {data.involvedPersons ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Personas involucradas
                  </p>
                  <p>{data.involvedPersons}</p>
                </div>
              ) : null}
              {data.occurredAt ? (
                <p className="text-xs text-muted-foreground">
                  Hechos ocurridos el {formatDate(data.occurredAt)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Buzon con el denunciante</CardTitle>
              <CardDescription>
                La conversacion es bidireccional y no revela la identidad del reportante.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md border p-3 text-sm ${
                    message.authorKind === 'officer' ? 'bg-primary/5' : 'bg-muted/40'
                  }`}
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {message.authorKind === 'officer' ? 'Oficial de etica' : 'Denunciante'} ·{' '}
                    {formatDateTime(message.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}

              <div className="space-y-2">
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={3}
                  placeholder="Escriba una respuesta para el denunciante"
                />
                <Button
                  size="sm"
                  loading={sendReply.isPending}
                  disabled={reply.trim().length < 2}
                  onClick={() => sendReply.mutate()}
                >
                  <Send className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Datos del reporte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Categoria" value={data.category?.name ?? '—'} />
              <Row label="Relacion" value={statusLabel(data.relationship)} />
              <Row label="Plazo legal" value={data.dueAt ? formatDate(data.dueAt) : '—'} />
              <Row
                label="Identidad"
                value={
                  data.isAnonymous ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      Anonima
                    </span>
                  ) : (
                    (data.reporterName ?? 'Identificada')
                  )
                }
              />
            </CardContent>
          </Card>

          {data.ethicsCase ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Caso {data.ethicsCase.caseNumber}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Badge tone={statusTone(data.ethicsCase.status)}>
                  {statusLabel(data.ethicsCase.status)}
                </Badge>
                {data.ethicsCase.investigationPlan ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Plan de investigacion
                    </p>
                    <p className="whitespace-pre-wrap">{data.ethicsCase.investigationPlan}</p>
                  </div>
                ) : null}
                {data.ethicsCase.conclusions ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conclusiones
                    </p>
                    <p className="whitespace-pre-wrap">{data.ethicsCase.conclusions}</p>
                  </div>
                ) : null}
                {data.ethicsCase.actions.length ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Acciones
                    </p>
                    {data.ethicsCase.actions.map((action) => (
                      <div key={action.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">{action.title}</p>
                        <Badge tone={statusTone(action.status)} className="mt-1 text-[10px]">
                          {statusLabel(action.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <OpenCaseDialog open={openCase} onOpenChange={setOpenCase} reportId={id} />
      <CloseCaseDialog
        open={closeCase}
        onOpenChange={setCloseCase}
        caseId={data.ethicsCase?.id ?? ''}
        reportId={id}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function OpenCaseDialog({
  open,
  onOpenChange,
  reportId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
}) {
  const queryClient = useQueryClient();
  const [severity, setSeverity] = React.useState('medium');
  const [plan, setPlan] = React.useState('');

  const openCase = useMutation({
    mutationFn: () =>
      apiPost(`/ethics/reports/${reportId}/case`, {
        severity,
        investigationPlan: plan || null,
        excludedUserIds: [],
      }),
    onSuccess: () => {
      toast.success('Caso abierto');
      void queryClient.invalidateQueries({ queryKey: ['ethics'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible abrir el caso', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caso de investigacion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Gravedad">
            <NativeSelect value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </NativeSelect>
          </Field>
          <Field label="Plan de investigacion">
            <Textarea
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              rows={4}
              placeholder="Entrevistas, evidencias a recolectar, plazos..."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={openCase.isPending} onClick={() => openCase.mutate()}>
            Abrir caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseCaseDialog({
  open,
  onOpenChange,
  caseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  reportId: string;
}) {
  const queryClient = useQueryClient();
  const [conclusions, setConclusions] = React.useState('');
  const [measures, setMeasures] = React.useState('');
  const [dismissed, setDismissed] = React.useState(false);

  const close = useMutation({
    mutationFn: () =>
      apiPost(`/ethics/cases/${caseId}/close`, {
        conclusions,
        measures: measures || null,
        dismissed,
      }),
    onSuccess: () => {
      toast.success('Caso cerrado');
      void queryClient.invalidateQueries({ queryKey: ['ethics'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible cerrar el caso', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar caso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Conclusiones" required>
            <Textarea
              value={conclusions}
              onChange={(event) => setConclusions(event.target.value)}
              rows={4}
            />
          </Field>
          <Field label="Medidas adoptadas">
            <Textarea
              value={measures}
              onChange={(event) => setMeasures(event.target.value)}
              rows={3}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dismissed}
              onChange={(event) => setDismissed(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Desestimar la denuncia (no se encontraron elementos)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={close.isPending}
            disabled={conclusions.trim().length < 10}
            onClick={() => close.mutate()}
          >
            Cerrar caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
