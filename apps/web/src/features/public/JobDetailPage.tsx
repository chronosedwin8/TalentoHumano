import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, CheckCircle2, MapPin, Paperclip, Upload } from 'lucide-react';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, uploadPublicFile } from '@/lib/api';
import { formatCurrency, formatDate, statusLabel } from '@/lib/utils';
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
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/overlays';
import { BrandButton, PublicShell, type PublicCompany } from './PublicShell';

interface Posting {
  id: string;
  slug: string;
  code: string;
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  workModality: string;
  contractType: string;
  openings: number;
  publishedAt: string | null;
  closesAt: string | null;
  salaryVisible: boolean;
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  department: { name: string } | null;
  location: { name: string; city: string | null } | null;
}

export function JobDetailPage() {
  const { companySlug = '', jobSlug = '' } = useParams();
  const [submitted, setSubmitted] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'job', companySlug, jobSlug],
    queryFn: () =>
      apiGet<{ company: PublicCompany; posting: Posting }>(
        `/public/careers/${companySlug}/jobs/${jobSlug}`,
      ),
    retry: false,
  });

  if (isError) {
    return (
      <PublicShell title="Vacante">
        <EmptyState
          icon={Briefcase}
          title="Vacante no disponible"
          description="Puede que ya se haya cerrado el proceso."
          action={
            <Button asChild variant="outline">
              <Link to={`/careers/${companySlug}`}>Ver todas las vacantes</Link>
            </Button>
          }
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

  const { company, posting } = data;

  return (
    <PublicShell company={company}>
      <Link
        to={`/careers/${companySlug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Todas las vacantes
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{posting.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {posting.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {posting.location.city ?? posting.location.name}
                </span>
              ) : null}
              <Badge tone="muted">{statusLabel(posting.workModality)}</Badge>
              <Badge tone="muted">{statusLabel(posting.contractType)}</Badge>
              {posting.department ? <span>{posting.department.name}</span> : null}
            </div>
            {posting.salaryVisible && posting.salaryRangeMin ? (
              <p className="mt-2 text-lg font-semibold">
                {formatCurrency(posting.salaryRangeMin)}
                {posting.salaryRangeMax ? ` — ${formatCurrency(posting.salaryRangeMax)}` : ''}
              </p>
            ) : null}
            {posting.closesAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Las postulaciones cierran el {formatDate(posting.closesAt)}
              </p>
            ) : null}
          </div>

          {posting.description ? <Section title="Descripcion" body={posting.description} /> : null}
          {posting.requirements ? <Section title="Requisitos" body={posting.requirements} /> : null}
          {posting.benefits ? <Section title="Beneficios" body={posting.benefits} /> : null}
        </div>

        <div>
          {submitted ? (
            <Card>
              <CardContent className="space-y-3 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <h2 className="font-semibold">Postulacion enviada</h2>
                <p className="text-sm text-muted-foreground">
                  Recibira un correo de confirmacion. Si su perfil avanza, el equipo de seleccion se
                  comunicara con usted.
                </p>
                <Button asChild variant="outline">
                  <Link to={`/careers/${companySlug}`}>Ver otras vacantes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ApplicationForm
              companySlug={companySlug}
              jobSlug={jobSlug}
              company={company}
              onSubmitted={() => setSubmitted(true)}
            />
          )}
        </div>
      </div>
    </PublicShell>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ApplicationForm({
  companySlug,
  jobSlug,
  company,
  onSubmitted,
}: {
  companySlug: string;
  jobSlug: string;
  company: PublicCompany;
  onSubmitted: () => void;
}) {
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    documentNumber: '',
    city: '',
    linkedinUrl: '',
    coverLetter: '',
  });
  const [consent, setConsent] = React.useState(false);
  const [resume, setResume] = React.useState<{ name: string; fileId: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { fileId } = await uploadPublicFile(companySlug, file);
      setResume({ name: file.name, fileId });
    } catch (error) {
      toast.error('No fue posible adjuntar la hoja de vida', (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const apply = useMutation({
    mutationFn: () =>
      apiPost(`/public/careers/${companySlug}/jobs/${jobSlug}/apply`, {
        ...form,
        documentNumber: form.documentNumber || null,
        city: form.city || null,
        linkedinUrl: form.linkedinUrl || null,
        coverLetter: form.coverLetter || null,
        resumeFileId: resume?.fileId ?? null,
        source: 'portal',
        consentAccepted: true,
      }),
    onSuccess: onSubmitted,
    onError: (error: Error) => toast.error('No fue posible enviar la postulacion', error.message),
  });

  const complete =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 6 &&
    consent;

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle className="text-base">Postularme</CardTitle>
        <CardDescription>Sus datos solo se usan para este proceso de seleccion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required>
            <Input
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </Field>
          <Field label="Apellido" required>
            <Input
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Correo" required>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefono" required>
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </Field>
          <Field label="Documento">
            <Input
              value={form.documentNumber}
              onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ciudad">
            <Input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </Field>
          <Field label="LinkedIn">
            <Input
              value={form.linkedinUrl}
              onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })}
              placeholder="https://"
            />
          </Field>
        </div>

        <Field label="Hoja de vida" hint="PDF o Word, hasta 10 MB">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {resume ? (
            <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{resume.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setResume(null)}>
                Quitar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Adjuntar archivo
            </Button>
          )}
        </Field>

        <Field label="Carta de presentacion">
          <Textarea
            value={form.coverLetter}
            onChange={(event) => setForm({ ...form, coverLetter: event.target.value })}
            rows={4}
            placeholder="Cuentenos por que le interesa esta vacante"
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            className="mt-0.5"
          />
          <span>
            Autorizo a {company.name} a tratar mis datos personales para este proceso de seleccion,
            conforme a la Ley 1581 de 2012 y a su politica de tratamiento de datos.
          </span>
        </label>

        <BrandButton
          className="w-full"
          disabled={!complete || apply.isPending}
          onClick={() => apply.mutate()}
        >
          {apply.isPending ? 'Enviando...' : 'Enviar postulacion'}
        </BrandButton>
      </CardContent>
    </Card>
  );
}
