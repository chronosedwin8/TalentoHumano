import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileCheck2, FileText, Printer, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface GeneratedRow {
  id: string;
  title: string;
  verificationCode: string;
  employeeId: string | null;
  isSelfService: boolean;
  createdAt: string;
}

interface GeneratedDetail extends GeneratedRow {
  contentHtml: string;
}

interface SelfServiceTemplate {
  id: string;
  name: string;
  kind: string;
  isSelfService: boolean;
}

export function MyDocumentsPage() {
  const { user, can } = useAuth();
  const [page, setPage] = React.useState(1);
  const [preview, setPreview] = React.useState<string | null>(null);

  // A plain employee only ever sees their own shelf; HR sees the whole register.
  const seesAll = can('documents.generated.read');
  const employeeId = user?.employee?.id ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'generated', page, seesAll],
    queryFn: () =>
      apiList<GeneratedRow>('/documents/generated', {
        page,
        limit: 25,
        ...(seesAll ? {} : { employeeId }),
      }),
    retry: false,
  });

  const { data: templates } = useQuery({
    queryKey: ['documents', 'self-service-templates'],
    queryFn: () => apiList<SelfServiceTemplate>('/documents/templates', { limit: 100 }),
    enabled: can('documents.template.read'),
    retry: false,
  });

  const selfServiceTemplates = (templates?.data ?? []).filter((template) => template.isSelfService);

  const generateCertificate = useMutation({
    mutationFn: (templateId?: string) =>
      apiPost<{ id: string; verificationCode: string; html: string }>(
        '/documents/self-service/certificate',
        templateId ? { templateId } : {},
      ),
    onSuccess: (result) => {
      toast.success('Certificado generado', `Codigo de verificacion ${result.verificationCode}`);
      setPreview(result.id);
    },
    onError: (error: Error) => toast.error('No fue posible generar el certificado', error.message),
  });

  const columns: Array<Column<GeneratedRow>> = [
    {
      key: 'title',
      header: 'Documento',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{row.title}</span>
        </div>
      ),
    },
    {
      key: 'verificationCode',
      header: 'Codigo de verificacion',
      render: (row) => <span className="font-mono text-xs">{row.verificationCode}</span>,
    },
    {
      key: 'isSelfService',
      header: 'Origen',
      hideOnMobile: true,
      render: (row) => (
        <Badge tone={row.isSelfService ? 'info' : 'muted'}>
          {row.isSelfService ? 'Autoservicio' : 'Emitido por RRHH'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Emitido',
      hideOnMobile: true,
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            setPreview(row.id);
          }}
        >
          <Printer className="h-4 w-4" />
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={seesAll ? 'Documentos generados' : 'Mis documentos'}
        description="Cada documento lleva un codigo QR de verificacion publica."
      />

      {can('documents.certificate.create') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Certificado laboral inmediato</CardTitle>
            <CardDescription>
              Se genera con sus datos vigentes y un codigo verificable por terceros sin exponer su
              informacion personal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {selfServiceTemplates.length ? (
              selfServiceTemplates.map((template) => (
                <Button
                  key={template.id}
                  loading={generateCertificate.isPending}
                  onClick={() => generateCertificate.mutate(template.id)}
                >
                  <FileCheck2 className="h-4 w-4" />
                  {template.name}
                </Button>
              ))
            ) : (
              <Button
                loading={generateCertificate.isPending}
                onClick={() => generateCertificate.mutate(undefined)}
              >
                <FileCheck2 className="h-4 w-4" />
                Generar certificado laboral
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        onRowClick={(row) => setPreview(row.id)}
        emptyTitle="Sin documentos"
        emptyDescription="Los certificados y cartas que se emitan apareceran aqui."
      />

      {preview ? <DocumentPreview id={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Renders the stored print-ready HTML inside a sandboxed iframe and lets the
 * browser produce the PDF (see ADR-0006: a `PdfRenderer` seam replaces this
 * when a headless renderer is available).
 */
function DocumentPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'generated', id],
    queryFn: () => apiGet<GeneratedDetail>(`/documents/generated/${id}`),
  });

  React.useEffect(() => {
    // Refresh the register so a just-generated document appears in the list.
    void queryClient.invalidateQueries({ queryKey: ['documents', 'generated'] });
  }, [id, queryClient]);

  const print = () => {
    const frame = frameRef.current;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const download = () => {
    if (!data) return;
    const blob = new Blob([data.contentHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.verificationCode}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{data?.title ?? 'Documento'}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <Skeleton className="h-[60vh] w-full" />
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-muted-foreground">
                Verificable en <span className="font-mono">/verificar/{data.verificationCode}</span>{' '}
                · emitido {formatDate(data.createdAt)}
              </span>
            </div>
            <iframe
              ref={frameRef}
              title={data.title}
              srcDoc={data.contentHtml}
              sandbox="allow-same-origin allow-modals"
              className="h-[60vh] w-full rounded-md border bg-white"
            />
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={download} disabled={!data}>
            <Download className="h-4 w-4" />
            Descargar
          </Button>
          <Button onClick={print} disabled={!data}>
            <Printer className="h-4 w-4" />
            Imprimir o guardar como PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
