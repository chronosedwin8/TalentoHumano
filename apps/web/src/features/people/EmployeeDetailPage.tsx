import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Phone,
  UserMinus,
} from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate, statusLabel, statusTone } from '@/lib/utils';
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
  Input,
  NativeSelect,
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

interface EmployeeDetail {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  status: string;
  hiredAt: string;
  terminatedAt: string | null;
  documentType: string;
  documentNumber: string;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  workModality: string;
  position: { id: string; name: string; level: string | null } | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string; city: string | null } | null;
  manager: { id: string; fullName: string; email: string } | null;
  directReports: Array<{ id: string; fullName: string }>;
  personalData: Record<string, any> | null;
  emergencyContacts: Array<{ id: string; name: string; relationship: string; phone: string }>;
  education: Array<{ id: string; level: string; institution: string; degree: string | null }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string | null;
    expiresAt: string | null;
  }>;
  skills: Array<{ id: string; level: number; skill: { name: string } }>;
  contracts: Array<{
    id: string;
    contractType: string;
    startDate: string;
    endDate: string | null;
    workModality: string;
    baseSalary: number | null;
    isCurrent: boolean;
  }>;
  movements: Array<{ id: string; movementType: string; effectiveDate: string; status: string }>;
  assetAssignments: Array<{
    id: string;
    assignedAt: string;
    returnedAt: string | null;
    asset: { name: string; code: string; assetType: string };
  }>;
  user: { id: string; email: string; status: string; lastLoginAt: string | null } | null;
  customFields: Array<{ key: string; label: string; value: unknown }>;
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const [terminateOpen, setTerminateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'employee', id],
    queryFn: () => apiGet<EmployeeDetail>(`/people/employees/${id}`),
    enabled: Boolean(id),
  });

  const { data: documents } = useQuery({
    queryKey: ['people', 'employee', id, 'documents'],
    queryFn: () =>
      apiGet<
        Array<{
          id: string;
          name: string;
          status: string;
          expiresAt: string | null;
          documentType: { name: string };
        }>
      >(`/people/employees/${id}/documents`),
    enabled: Boolean(id) && can('people.document.read'),
    retry: false,
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const canSeeSensitive = can('people.sensitive.read');

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/people')}>
        <ArrowLeft className="h-4 w-4" />
        Volver a colaboradores
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar name={data.fullName} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{data.fullName}</h1>
              <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {data.position?.name ?? 'Sin cargo'} · {data.department?.name ?? 'Sin area'}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {data.email}
              </span>
              {data.mobile ? (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {data.mobile}
                </span>
              ) : null}
              {data.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {data.location.name}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                Ingreso {formatDate(data.hiredAt)}
              </span>
            </div>
          </div>
          {can('people.employee.update') && data.status === 'active' ? (
            <Button variant="outline" onClick={() => setTerminateOpen(true)}>
              <UserMinus className="h-4 w-4" />
              Registrar retiro
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="personales">
        <TabsList>
          <TabsTrigger value="personales">Datos personales</TabsTrigger>
          <TabsTrigger value="vinculacion">Vinculacion</TabsTrigger>
          <TabsTrigger value="legajo">Legajo</TabsTrigger>
          <TabsTrigger value="formacion">Formacion</TabsTrigger>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="personales">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Identificacion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Documento" value={`${data.documentType} ${data.documentNumber}`} />
                <Row label="Fecha de nacimiento" value={formatDate(data.birthDate)} />
                <Row label="Direccion" value={data.address ?? '—'} />
                <Row label="Ciudad" value={data.city ?? '—'} />
                <Row label="Modalidad" value={statusLabel(data.workModality)} />
                {data.customFields.map((field) => (
                  <Row key={field.key} label={field.label} value={String(field.value ?? '—')} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Datos sensibles
                  {!canSeeSensitive ? <Lock className="h-4 w-4 text-muted-foreground" /> : null}
                </CardTitle>
                <CardDescription>
                  {canSeeSensitive
                    ? 'Cada consulta queda registrada en el log de accesos sensibles.'
                    : 'No tiene permiso para ver esta informacion.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="EPS" value={data.personalData?.eps ?? '—'} />
                <Row label="ARL" value={data.personalData?.arl ?? '—'} />
                <Row label="Fondo de pensiones" value={data.personalData?.pensionFund ?? '—'} />
                <Row label="Grupo sanguineo" value={data.personalData?.bloodType ?? '—'} />
                <Row
                  label="Banco"
                  value={canSeeSensitive ? (data.personalData?.bankName ?? '—') : '••••••'}
                />
                <Row
                  label="Salario base (informativo)"
                  value={
                    canSeeSensitive && data.personalData?.baseSalary
                      ? formatCurrency(Number(data.personalData.baseSalary))
                      : '••••••'
                  }
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Contactos de emergencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.emergencyContacts.length === 0 ? (
                  <p className="text-muted-foreground">Sin contactos registrados.</p>
                ) : (
                  data.emergencyContacts.map((contact) => (
                    <div key={contact.id} className="flex justify-between rounded-md border p-3">
                      <span>
                        {contact.name}{' '}
                        <span className="text-muted-foreground">({contact.relationship})</span>
                      </span>
                      <span className="tabular-nums">{contact.phone}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vinculacion">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contratos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.contracts.map((contract) => (
                  <div key={contract.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">
                        {contract.contractType.replace(/_/g, ' ')}
                      </span>
                      {contract.isCurrent ? <Badge tone="success">Vigente</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(contract.startDate)} —{' '}
                      {contract.endDate ? formatDate(contract.endDate) : 'indefinido'} ·{' '}
                      {statusLabel(contract.workModality)}
                    </p>
                    {canSeeSensitive && contract.baseSalary ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Salario informativo: {formatCurrency(contract.baseSalary)}
                      </p>
                    ) : null}
                  </div>
                ))}
                {data.contracts.length === 0 ? (
                  <p className="text-muted-foreground">Sin contratos registrados.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos de personal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.movements.length === 0 ? (
                  <p className="text-muted-foreground">Sin movimientos registrados.</p>
                ) : (
                  data.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <span className="capitalize">{movement.movementType.replace(/_/g, ' ')}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {formatDate(movement.effectiveDate)}
                        <Badge tone={statusTone(movement.status)}>
                          {statusLabel(movement.status)}
                        </Badge>
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {data.user ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Cuenta de acceso</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                  <Row label="Usuario" value={data.user.email} />
                  <Row label="Estado" value={statusLabel(data.user.status)} />
                  <Row label="Ultimo ingreso" value={formatDate(data.user.lastLoginAt)} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="legajo">
          <Card>
            <CardHeader>
              <CardTitle>Legajo digital</CardTitle>
              <CardDescription>Documentos del colaborador con sus vencimientos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(documents ?? []).length === 0 ? (
                <EmptyState icon={FileText} title="Sin documentos cargados" />
              ) : (
                documents?.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center gap-3 rounded-md border p-3 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{document.name}</p>
                      <p className="text-xs text-muted-foreground">{document.documentType.name}</p>
                    </div>
                    {document.expiresAt ? (
                      <span className="text-xs text-muted-foreground">
                        Vence {formatDate(document.expiresAt)}
                      </span>
                    ) : null}
                    <Badge tone={statusTone(document.status)}>{statusLabel(document.status)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formacion">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Formacion academica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.education.map((row) => (
                  <div key={row.id} className="rounded-md border p-3">
                    <p className="font-medium">{row.degree ?? row.level}</p>
                    <p className="text-xs text-muted-foreground">{row.institution}</p>
                  </div>
                ))}
                {data.education.length === 0 ? (
                  <p className="text-muted-foreground">Sin registros.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certificaciones y habilidades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.certifications.map((certification) => (
                  <div key={certification.id} className="rounded-md border p-3">
                    <p className="font-medium">{certification.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {certification.issuer ?? '—'}
                      {certification.expiresAt
                        ? ` · vence ${formatDate(certification.expiresAt)}`
                        : ''}
                    </p>
                  </div>
                ))}
                {data.skills.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.skills.map((skill) => (
                      <Badge key={skill.id} tone="muted">
                        {skill.skill.name} · {skill.level}/5
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activos">
          <Card>
            <CardHeader>
              <CardTitle>Activos asignados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.assetAssignments.length === 0 ? (
                <EmptyState icon={Laptop} title="Sin activos asignados" />
              ) : (
                data.assetAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{assignment.asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.asset.code} · entregado {formatDate(assignment.assignedAt)}
                      </p>
                    </div>
                    <Badge tone={assignment.returnedAt ? 'muted' : 'success'}>
                      {assignment.returnedAt
                        ? `Devuelto ${formatDate(assignment.returnedAt)}`
                        : 'En uso'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Jefe directo</CardTitle>
              </CardHeader>
              <CardContent>
                {data.manager ? (
                  <Link
                    to={`/people/employees/${data.manager.id}`}
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent"
                  >
                    <Avatar name={data.manager.fullName} size="sm" />
                    <div>
                      <p className="font-medium">{data.manager.fullName}</p>
                      <p className="text-xs text-muted-foreground">{data.manager.email}</p>
                    </div>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin jefe asignado.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reportes directos ({data.directReports.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.directReports.map((report) => (
                  <Link
                    key={report.id}
                    to={`/people/employees/${report.id}`}
                    className="flex items-center gap-3 rounded-md border p-2.5 text-sm hover:bg-accent"
                  >
                    <Avatar name={report.fullName} size="sm" />
                    {report.fullName}
                  </Link>
                ))}
                {data.directReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin reportes directos.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <TerminateDialog open={terminateOpen} onOpenChange={setTerminateOpen} employeeId={id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function TerminateDialog({
  open,
  onOpenChange,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    terminatedAt: new Date().toISOString().slice(0, 10),
    exitReason: 'renuncia',
    notes: '',
  });

  const terminate = useMutation({
    mutationFn: () => apiPost(`/people/employees/${employeeId}/terminate`, form),
    onSuccess: () => {
      toast.success('Retiro registrado', 'Se desactivo el usuario y se cerro el contrato vigente.');
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar el retiro', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar retiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Fecha efectiva" required>
            <Input
              type="date"
              value={form.terminatedAt}
              onChange={(event) => setForm({ ...form, terminatedAt: event.target.value })}
            />
          </Field>
          <Field label="Motivo de salida" required>
            <NativeSelect
              value={form.exitReason}
              onChange={(event) => setForm({ ...form, exitReason: event.target.value })}
            >
              <option value="renuncia">Renuncia voluntaria</option>
              <option value="terminacion">Terminacion por el empleador</option>
              <option value="fin_contrato">Vencimiento del contrato</option>
              <option value="mutuo_acuerdo">Mutuo acuerdo</option>
              <option value="jubilacion">Jubilacion</option>
              <option value="fallecimiento">Fallecimiento</option>
            </NativeSelect>
          </Field>
          <Field label="Observaciones">
            <Textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            loading={terminate.isPending}
            onClick={() => terminate.mutate()}
          >
            Registrar retiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
