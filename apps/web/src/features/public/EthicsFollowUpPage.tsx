import { useMutation } from '@tanstack/react-query';
import { KeyRound, Send, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { apiPost } from '@/lib/api';
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
  Input,
  Textarea,
} from '@/components/ui/primitives';
import { BrandButton, PublicShell } from './PublicShell';

interface FollowUp {
  trackingCode: string;
  status: string;
  category: string | null;
  subject: string;
  description: string;
  createdAt: string;
  dueAt: string | null;
  case: { caseNumber: string; status: string; closedAt: string | null } | null;
  messages: Array<{ id: string; authorKind: string; body: string; createdAt: string }>;
}

export function EthicsFollowUpPage() {
  const [credentials, setCredentials] = React.useState({ trackingCode: '', accessKey: '' });
  const [report, setReport] = React.useState<FollowUp | null>(null);
  const [message, setMessage] = React.useState('');

  const lookup = useMutation({
    mutationFn: () => apiPost<FollowUp>('/public/ethics/follow-up', credentials),
    onSuccess: setReport,
    onError: (error: Error) => toast.error('No fue posible consultar', error.message),
  });

  const reply = useMutation({
    mutationFn: () => apiPost('/public/ethics/messages', { ...credentials, message }),
    onSuccess: () => {
      toast.success('Mensaje enviado');
      setMessage('');
      lookup.mutate();
    },
    onError: (error: Error) => toast.error('No fue posible enviar el mensaje', error.message),
  });

  return (
    <PublicShell
      title="Seguimiento de su denuncia"
      subtitle="Use el codigo y la clave que recibio al enviarla."
      className="max-w-3xl"
    >
      {!report ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5" />
              Consultar estado
            </CardTitle>
            <CardDescription>
              Nadie puede ver su denuncia sin estos dos datos, ni siquiera la empresa puede
              vincularla con usted si la envio de forma anonima.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Codigo de seguimiento" required>
              <Input
                value={credentials.trackingCode}
                onChange={(event) =>
                  setCredentials({
                    ...credentials,
                    trackingCode: event.target.value.toUpperCase().trim(),
                  })
                }
                placeholder="ETH-XXXX-XXXX"
                className="font-mono"
              />
            </Field>
            <Field label="Clave de acceso" required>
              <Input
                value={credentials.accessKey}
                onChange={(event) =>
                  setCredentials({ ...credentials, accessKey: event.target.value.trim() })
                }
                className="font-mono"
              />
            </Field>
            <BrandButton
              className="w-full"
              disabled={
                credentials.trackingCode.length < 8 ||
                credentials.accessKey.length < 6 ||
                lookup.isPending
              }
              onClick={() => lookup.mutate()}
            >
              {lookup.isPending ? 'Consultando...' : 'Consultar'}
            </BrandButton>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">{report.subject}</CardTitle>
                  <CardDescription>
                    Codigo {report.trackingCode} · recibida {formatDate(report.createdAt)}
                    {report.category ? ` · ${report.category}` : ''}
                  </CardDescription>
                </div>
                <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap text-muted-foreground">{report.description}</p>
              {report.dueAt ? (
                <p className="text-xs text-muted-foreground">
                  Plazo de respuesta: {formatDate(report.dueAt)}
                </p>
              ) : null}
              {report.case ? (
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    Su denuncia dio lugar al caso {report.case.caseNumber} ·{' '}
                    {statusLabel(report.case.status)}
                    {report.case.closedAt
                      ? ` · cerrado el ${formatDate(report.case.closedAt)}`
                      : ''}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversacion con el investigador</CardTitle>
              <CardDescription>Sus mensajes no revelan su identidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aun no hay mensajes.</p>
              ) : (
                report.messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-md border p-3 text-sm ${
                      entry.authorKind === 'officer' ? 'bg-primary/5' : 'bg-muted/40'
                    }`}
                  >
                    <p className="mb-1 text-xs text-muted-foreground">
                      {entry.authorKind === 'officer' ? 'Oficial de etica' : 'Usted'} ·{' '}
                      {formatDateTime(entry.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{entry.body}</p>
                  </div>
                ))
              )}

              <div className="space-y-2 border-t pt-3">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  placeholder="Escriba un mensaje o aporte informacion adicional"
                />
                <Button
                  loading={reply.isPending}
                  disabled={message.trim().length < 2}
                  onClick={() => reply.mutate()}
                >
                  <Send className="h-4 w-4" />
                  Enviar mensaje
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            onClick={() => {
              setReport(null);
              setCredentials({ trackingCode: '', accessKey: '' });
            }}
          >
            Salir del seguimiento
          </Button>
        </div>
      )}
    </PublicShell>
  );
}
