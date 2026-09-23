import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Button,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@/components/ui/overlays';

interface OfferRow {
  id: string;
  status: string;
  workModality: string;
  contractType: string | null;
  startDate: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  salary: number | null;
  application: {
    id: string;
    status: string;
    candidate: { id: string; fullName: string; email: string };
    jobPosting: { id: string; title: string; code: string };
  };
}

/** Offer letters: drafted here, e-mailed with a public accept/reject link. */
export function OffersPage() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [sending, setSending] = React.useState<OfferRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'offers', { page, status }],
    queryFn: () => apiList<OfferRow>('/recruiting/offers', { page, limit: 25, status }),
  });

  const send = useMutation({
    mutationFn: (id: string) => apiPost(`/recruiting/offers/${id}/send`),
    onSuccess: () => {
      toast.success('Oferta enviada', 'El candidato recibio el correo con el enlace de respuesta.');
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'offers'] });
      setSending(null);
    },
    onError: (error: Error) => toast.error('No fue posible enviar', error.message),
  });

  const columns: Array<Column<OfferRow>> = [
    {
      key: 'candidate',
      header: 'Candidato',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.application.candidate.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.application.jobPosting.title}
          </p>
        </div>
      ),
    },
    {
      key: 'terms',
      header: 'Condiciones',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm">
          {row.contractType ?? 'Contrato sin definir'} · {statusLabel(row.workModality)}
          {row.startDate ? ` · inicia ${formatDate(row.startDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Enviada / vence',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.sentAt ? formatDateTime(row.sentAt) : 'borrador'}
          {row.expiresAt ? ` · vence ${formatDate(row.expiresAt)}` : ''}
        </span>
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
        can('recruiting.offer.send') && ['draft', 'sent'].includes(row.status) ? (
          <span className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                setSending(row);
              }}
            >
              <Send className="h-4 w-4" />
              {row.status === 'sent' ? 'Reenviar' : 'Enviar'}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ofertas"
        description="Cartas de oferta con condiciones y plazo. El candidato acepta o rechaza desde un enlace sin necesidad de cuenta."
        actions={
          can('recruiting.offer.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva oferta
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin ofertas"
        emptyDescription="Cree la primera desde una postulacion en etapa de oferta."
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="accepted">Aceptada</option>
            <option value="rejected">Rechazada</option>
            <option value="expired">Vencida</option>
          </NativeSelect>
        }
      />
      <CreateOfferDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={Boolean(sending)}
        onOpenChange={(open) => (!open ? setSending(null) : undefined)}
        title="Enviar la oferta por correo"
        description={
          sending
            ? `Se enviara a ${sending.application.candidate.email} con el enlace para aceptar o rechazar.`
            : undefined
        }
        confirmLabel="Enviar"
        loading={send.isPending}
        onConfirm={() => (sending ? send.mutate(sending.id) : undefined)}
      />
    </div>
  );
}

interface PipelineColumn {
  stage: { id: string; name: string; kind: string };
  applications: Array<{ id: string; candidate: { fullName: string } }>;
}

function CreateOfferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = React.useState('');
  const [form, setForm] = React.useState({
    applicationId: '',
    positionId: '',
    departmentId: '',
    locationId: '',
    contractType: 'Termino indefinido',
    workModality: 'onsite',
    startDate: '',
    salary: '',
    benefits: '',
    body: '',
    expiresAt: '',
  });

  const { data: jobs } = useQuery({
    queryKey: ['recruiting', 'jobs', 'select'],
    queryFn: () =>
      apiList<{ id: string; title: string; code: string }>('/recruiting/jobs', { limit: 100 }),
    enabled: open,
    retry: false,
  });
  const { data: pipeline } = useQuery({
    queryKey: ['recruiting', 'pipeline', jobId],
    queryFn: () => apiGet<PipelineColumn[]>(`/recruiting/jobs/${jobId}/pipeline`),
    enabled: open && Boolean(jobId),
    retry: false,
  });
  const { data: positions } = useQuery({
    queryKey: ['organization', 'positions'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/positions'),
    enabled: open,
    retry: false,
  });
  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    enabled: open,
    retry: false,
  });
  const { data: locations } = useQuery({
    queryKey: ['organization', 'locations'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/locations'),
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/recruiting/offers', {
        applicationId: form.applicationId,
        positionId: form.positionId || null,
        departmentId: form.departmentId || null,
        locationId: form.locationId || null,
        contractType: form.contractType || null,
        workModality: form.workModality,
        startDate: form.startDate || null,
        salary: form.salary ? Number(form.salary) : null,
        benefits: form.benefits || null,
        body: form.body || null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success('Oferta creada', 'Queda como borrador hasta que la envie.');
      void queryClient.invalidateQueries({ queryKey: ['recruiting', 'offers'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear la oferta', error.message),
  });

  const select = (
    label: string,
    key: 'positionId' | 'departmentId' | 'locationId',
    rows: Array<{ id: string; name: string }> | undefined,
  ) => (
    <Field label={label}>
      <NativeSelect
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      >
        <option value="">Sin definir</option>
        {(rows ?? []).map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva carta de oferta</DialogTitle>
          <DialogDescription>
            El salario se guarda cifrado y solo se muestra a quien tiene el permiso. No se calcula
            nada: es el valor ofrecido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vacante" required>
              <NativeSelect
                value={jobId}
                onChange={(event) => {
                  setJobId(event.target.value);
                  setForm({ ...form, applicationId: '' });
                }}
              >
                <option value="">Seleccione...</option>
                {(jobs?.data ?? []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.code} · {job.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Candidato" required>
              <NativeSelect
                value={form.applicationId}
                onChange={(event) => setForm({ ...form, applicationId: event.target.value })}
                disabled={!jobId}
              >
                <option value="">Seleccione...</option>
                {(pipeline ?? [])
                  .filter((column) => column.stage.kind !== 'rejected')
                  .flatMap((column) =>
                    column.applications.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.candidate.fullName} · {column.stage.name}
                      </option>
                    )),
                  )}
              </NativeSelect>
            </Field>
            {select('Cargo', 'positionId', positions)}
            {select('Area', 'departmentId', departments)}
            {select('Sede', 'locationId', locations)}
            <Field label="Modalidad">
              <NativeSelect
                value={form.workModality}
                onChange={(event) => setForm({ ...form, workModality: event.target.value })}
              >
                <option value="onsite">Presencial</option>
                <option value="hybrid">Hibrido</option>
                <option value="remote">Remoto</option>
              </NativeSelect>
            </Field>
            <Field label="Tipo de contrato">
              <Input
                value={form.contractType}
                onChange={(event) => setForm({ ...form, contractType: event.target.value })}
              />
            </Field>
            <Field label="Fecha de inicio">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </Field>
            <Field label="Salario ofrecido" hint="Cifrado; solo visible con permiso">
              <Input
                type="number"
                min={0}
                value={form.salary}
                onChange={(event) => setForm({ ...form, salary: event.target.value })}
              />
            </Field>
            <Field label="Plazo para responder">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Beneficios">
            <Textarea
              rows={2}
              value={form.benefits}
              onChange={(event) => setForm({ ...form, benefits: event.target.value })}
            />
          </Field>
          <Field
            label="Texto de la carta"
            hint="Se incluye en el correo y en la pagina de respuesta"
          >
            <Textarea
              rows={6}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.applicationId}
            onClick={() => create.mutate()}
          >
            Crear borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
