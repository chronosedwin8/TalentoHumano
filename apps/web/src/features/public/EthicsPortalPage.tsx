import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, EyeOff, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, uploadPublicFile } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
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
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/overlays';
import { BrandButton, PublicShell, type PublicCompany } from './PublicShell';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface SubmitResult {
  trackingCode: string;
  accessKey: string;
  dueAt: string | null;
}

export function EthicsPortalPage() {
  const { companySlug = '' } = useParams();
  const [result, setResult] = React.useState<SubmitResult | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'ethics', companySlug],
    queryFn: () =>
      apiGet<{ company: PublicCompany; categories: Category[] }>(`/public/ethics/${companySlug}`),
    retry: false,
  });

  if (isError) {
    return (
      <PublicShell title="Canal de denuncias">
        <EmptyState
          icon={ShieldCheck}
          title="Empresa no encontrada"
          description="Verifique el enlace."
        />
      </PublicShell>
    );
  }

  if (isLoading || !data) {
    return (
      <PublicShell>
        <Skeleton className="h-96 w-full" />
      </PublicShell>
    );
  }

  return (
    <PublicShell
      company={data.company}
      title="Canal de denuncias"
      subtitle="Reporte de forma segura conductas contrarias a la etica, el acoso laboral o cualquier irregularidad."
      className="max-w-3xl"
    >
      {result ? (
        <ReceiptCard result={result} />
      ) : (
        <>
          <Card className="mb-4 border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex gap-3 p-4 text-sm">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">Su anonimato esta protegido</p>
                <p>
                  Si elige reportar de forma anonima, el sistema no guarda su direccion IP, su
                  navegador ni ningun dato que permita identificarlo. Recibira un codigo con el que
                  podra seguir el caso y conversar con el investigador sin revelar quien es.
                </p>
              </div>
            </CardContent>
          </Card>

          <ReportForm
            companySlug={companySlug}
            company={data.company}
            categories={data.categories}
            onSubmitted={setResult}
          />

          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya envio una denuncia?{' '}
            <Link
              to="/ethics-seguimiento"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Consulte su estado
            </Link>
          </p>
        </>
      )}
    </PublicShell>
  );
}

/* -------------------------------------------------------------------------- */

function ReceiptCard({ result }: { result: SubmitResult }) {
  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Denuncia recibida
        </CardTitle>
        <CardDescription>
          Guarde estos datos ahora. Son la unica forma de consultar su caso y no se pueden
          recuperar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <CodeRow label="Codigo de seguimiento" value={result.trackingCode} onCopy={copy} />
          <CodeRow label="Clave de acceso" value={result.accessKey} onCopy={copy} />
        </div>
        {result.dueAt ? (
          <p className="text-sm text-muted-foreground">
            El equipo debe dar respuesta antes del <strong>{formatDate(result.dueAt)}</strong>,
            conforme a los plazos legales aplicables.
          </p>
        ) : null}
        <Button asChild className="w-full">
          <Link to="/ethics-seguimiento">Ir al seguimiento</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CodeRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-sm">{value}</code>
        <Button size="sm" variant="outline" onClick={() => onCopy(value, label)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReportForm({
  companySlug,
  company,
  categories,
  onSubmitted,
}: {
  companySlug: string;
  company: PublicCompany;
  categories: Category[];
  onSubmitted: (result: SubmitResult) => void;
}) {
  const [form, setForm] = React.useState({
    categoryId: '',
    isAnonymous: true,
    reporterName: '',
    reporterEmail: '',
    reporterPhone: '',
    relationship: 'employee',
    subject: '',
    description: '',
    occurredAt: '',
    involvedPersons: '',
  });
  const [consent, setConsent] = React.useState(false);
  const [files, setFiles] = React.useState<Array<{ name: string; fileId: string }>>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { fileId } = await uploadPublicFile(companySlug, file);
      setFiles((current) => [...current, { name: file.name, fileId }]);
    } catch (error) {
      toast.error('No fue posible adjuntar el archivo', (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = useMutation({
    mutationFn: () =>
      apiPost<SubmitResult>(`/public/ethics/${companySlug}/reports`, {
        categoryId: form.categoryId || null,
        isAnonymous: form.isAnonymous,
        reporterName: form.isAnonymous ? null : form.reporterName || null,
        reporterEmail: form.isAnonymous ? null : form.reporterEmail || null,
        reporterPhone: form.isAnonymous ? null : form.reporterPhone || null,
        relationship: form.relationship,
        subject: form.subject,
        description: form.description,
        occurredAt: form.occurredAt || null,
        involvedPersons: form.involvedPersons || null,
        fileIds: files.map((file) => file.fileId),
        consentAccepted: true,
      }),
    onSuccess: onSubmitted,
    onError: (error: Error) => toast.error('No fue posible enviar la denuncia', error.message),
  });

  const complete =
    form.subject.trim().length >= 5 && form.description.trim().length >= 20 && consent;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nueva denuncia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="identity"
              checked={form.isAnonymous}
              onChange={() => setForm({ ...form, isAnonymous: true })}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium">Reportar de forma anonima</span>
              <span className="block text-xs text-muted-foreground">
                No se guarda IP, dispositivo ni datos de contacto.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="identity"
              checked={!form.isAnonymous}
              onChange={() => setForm({ ...form, isAnonymous: false })}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium">Identificarme</span>
              <span className="block text-xs text-muted-foreground">
                Sus datos solo los conoce el oficial de etica.
              </span>
            </span>
          </label>
        </div>

        {!form.isAnonymous ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre">
              <Input
                value={form.reporterName}
                onChange={(event) => setForm({ ...form, reporterName: event.target.value })}
              />
            </Field>
            <Field label="Correo">
              <Input
                type="email"
                value={form.reporterEmail}
                onChange={(event) => setForm({ ...form, reporterEmail: event.target.value })}
              />
            </Field>
            <Field label="Telefono">
              <Input
                value={form.reporterPhone}
                onChange={(event) => setForm({ ...form, reporterPhone: event.target.value })}
              />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <NativeSelect
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">Seleccione una categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Su relacion con la empresa">
            <NativeSelect
              value={form.relationship}
              onChange={(event) => setForm({ ...form, relationship: event.target.value })}
            >
              <option value="employee">Colaborador</option>
              <option value="client">Cliente</option>
              <option value="supplier">Proveedor</option>
              <option value="contractor">Contratista</option>
              <option value="other">Otra</option>
            </NativeSelect>
          </Field>
        </div>

        <Field label="Asunto" required>
          <Input
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            placeholder="Resuma en una linea lo que quiere reportar"
          />
        </Field>

        <Field
          label="Que ocurrio"
          required
          hint="Describa los hechos con el mayor detalle posible: que paso, cuando y donde."
        >
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={7}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha de los hechos">
            <Input
              type="date"
              value={form.occurredAt}
              onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
            />
          </Field>
          <Field label="Personas involucradas">
            <Input
              value={form.involvedPersons}
              onChange={(event) => setForm({ ...form, involvedPersons: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Evidencias" hint="PDF, Word o imagen, hasta 10 MB cada una">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.fileId}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFiles(files.filter((item) => item.fileId !== file.fileId))}
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Adjuntar evidencia
            </Button>
          </div>
        </Field>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            className="mt-0.5"
          />
          <span>
            Declaro que la informacion es veraz y autorizo a {company.name} a tratarla para
            investigar los hechos reportados, conforme a la Ley 1581 de 2012.
          </span>
        </label>

        <BrandButton
          className="w-full"
          disabled={!complete || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? 'Enviando...' : 'Enviar denuncia'}
        </BrandButton>
      </CardContent>
    </Card>
  );
}
