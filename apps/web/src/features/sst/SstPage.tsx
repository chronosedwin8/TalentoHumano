import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, HardHat, Plus, ShieldCheck, Stethoscope } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart, HeatGrid } from '@/components/charts';
import { DataTable, type Column } from '@/components/DataTable';
import { EmployeePicker } from '@/components/EmployeePicker';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatNumber, statusLabel, statusTone, todayKey } from '@/lib/utils';
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
  StatCard,
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

interface Indicators {
  year: number;
  headcount: number;
  accidents: number;
  incidents: number;
  occupationalDiseases: number;
  lostDays: number;
  frequencyRate: number;
  severityRate: number;
  medicalAbsenteeismRate: number;
  medicalLeaveCount: number;
  totalAbsenceDays: number;
}

const EXAM_KINDS = [
  { value: 'entry', label: 'Ingreso' },
  { value: 'periodic', label: 'Periodico' },
  { value: 'exit', label: 'Retiro' },
  { value: 'post_incapacity', label: 'Post incapacidad' },
  { value: 'special', label: 'Especial' },
];

const EXAM_RESULTS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'fit', label: 'Apto' },
  { value: 'fit_with_restrictions', label: 'Apto con restricciones' },
  { value: 'unfit', label: 'No apto' },
];

export function SstPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const [active, setActive] = React.useState(tab ?? 'indicadores');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguridad y salud en el trabajo"
        description="Decreto 1072 de 2015 y Resolucion 0312 de 2019: indicadores minimos, matriz de riesgos y comites."
      />

      <Tabs
        value={active}
        onValueChange={(value) => {
          setActive(value);
          navigate('/sst', { replace: true });
        }}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          {can('sst.medicalexam.read') ? (
            <TabsTrigger value="examenes">Examenes medicos</TabsTrigger>
          ) : null}
          {can('sst.accident.read') ? (
            <TabsTrigger value="accidentes">Accidentalidad</TabsTrigger>
          ) : null}
          {can('sst.risk.manage') ? (
            <TabsTrigger value="riesgos">Matriz de riesgos</TabsTrigger>
          ) : null}
          {can('sst.ppe.read') ? <TabsTrigger value="epp">EPP</TabsTrigger> : null}
          {can('sst.inspection.read') ? (
            <TabsTrigger value="inspecciones">Inspecciones</TabsTrigger>
          ) : null}
          {can('sst.committee.manage') ? <TabsTrigger value="comites">Comites</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="indicadores">
          <IndicatorsTab />
        </TabsContent>
        <TabsContent value="examenes">
          <MedicalExamsTab />
        </TabsContent>
        <TabsContent value="accidentes">
          <AccidentsTab />
        </TabsContent>
        <TabsContent value="riesgos">
          <RiskMatrixTab />
        </TabsContent>
        <TabsContent value="epp">
          <PpeTab />
        </TabsContent>
        <TabsContent value="inspecciones">
          <InspectionsTab />
        </TabsContent>
        <TabsContent value="comites">
          <CommitteesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- indicators ------------------------------- */

function IndicatorsTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);

  const { data } = useQuery({
    queryKey: ['sst', 'indicators', year],
    queryFn: () => apiGet<Indicators>('/sst/indicators', { year }),
    retry: false,
  });

  const { data: expiring } = useQuery({
    queryKey: ['sst', 'exams', 'expiring'],
    queryFn: () =>
      apiGet<Array<{ id: string; expiresAt: string; employee: { id: string; fullName: string } }>>(
        '/sst/medical-exams/expiring',
        { days: 60 },
      ),
    retry: false,
  });

  if (!data) return <EmptyState icon={ShieldCheck} title="Sin indicadores disponibles" />;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <NativeSelect
          value={String(year)}
          onChange={(event) => setYear(Number(event.target.value))}
          className="w-32"
        >
          {[0, 1, 2, 3].map((offset) => (
            <option key={offset} value={currentYear - offset}>
              {currentYear - offset}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">
          Calculado sobre {data.headcount} colaboradores activos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Indice de frecuencia"
          value={formatNumber(data.frequencyRate, 2)}
          hint="Accidentes por cada 100 trabajadores"
          tone={data.frequencyRate > 10 ? 'danger' : data.frequencyRate > 5 ? 'warning' : 'success'}
        />
        <StatCard
          label="Indice de severidad"
          value={formatNumber(data.severityRate, 2)}
          hint="Dias perdidos por cada 100 trabajadores"
          tone={data.severityRate > 50 ? 'danger' : data.severityRate > 20 ? 'warning' : 'success'}
        />
        <StatCard
          label="Ausentismo por causa medica"
          value={`${formatNumber(data.medicalAbsenteeismRate, 2)} %`}
          hint={`${data.medicalLeaveCount} incapacidades`}
        />
        <StatCard label="Dias perdidos" value={formatNumber(data.lostDays)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Eventos del ano {data.year}</CardTitle>
            <CardDescription>
              Registro informativo. El reporte legal a la ARL se realiza en sus canales oficiales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                { label: 'Accidentes', value: data.accidents },
                { label: 'Incidentes', value: data.incidents },
                { label: 'Enfermedad laboral', value: data.occupationalDiseases },
              ]}
              height={220}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Examenes por vencer (60 dias)</CardTitle>
            <CardDescription>
              Programe los examenes periodicos antes del vencimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto">
            {(expiring ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningun examen vence en los proximos 60 dias.
              </p>
            ) : (
              expiring?.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="min-w-0 truncate">{exam.employee.fullName}</span>
                  <Badge tone={new Date(exam.expiresAt) < new Date() ? 'danger' : 'warning'}>
                    {formatDate(exam.expiresAt)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- medical exams ------------------------------ */

function MedicalExamsTab() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [kind, setKind] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'exams', page, kind],
    queryFn: () => apiList<any>('/sst/medical-exams', { page, limit: 25, kind }),
    retry: false,
  });

  const columns: Array<Column<any>> = [
    { key: 'employee', header: 'Colaborador', render: (row) => row.employee?.fullName ?? '—' },
    {
      key: 'kind',
      header: 'Tipo',
      render: (row) => EXAM_KINDS.find((item) => item.value === row.kind)?.label ?? row.kind,
    },
    {
      key: 'provider',
      header: 'Proveedor',
      hideOnMobile: true,
      render: (row) => row.provider ?? '—',
    },
    { key: 'performedAt', header: 'Realizado', render: (row) => formatDate(row.performedAt) },
    {
      key: 'expiresAt',
      header: 'Vence',
      hideOnMobile: true,
      render: (row) =>
        row.expiresAt ? (
          <span
            className={new Date(row.expiresAt) < new Date() ? 'font-medium text-destructive' : ''}
          >
            {formatDate(row.expiresAt)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'result',
      header: 'Concepto',
      render: (row) => (
        <Badge tone={statusTone(row.result)}>
          {EXAM_RESULTS.find((item) => item.value === row.result)?.label ?? statusLabel(row.result)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            Las restricciones y recomendaciones estan cifradas. Cada consulta queda registrada en el
            historial de accesos a datos sensibles.
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin examenes registrados"
        toolbar={
          <>
            <NativeSelect
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Todos los tipos</option>
              {EXAM_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
            {can('sst.medicalexam.create') ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Registrar examen
              </Button>
            ) : null}
          </>
        }
      />

      {creating ? <ExamDialog open onOpenChange={() => setCreating(false)} /> : null}
    </div>
  );
}

function ExamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    employeeId: '',
    kind: 'periodic',
    provider: '',
    performedAt: todayKey(),
    expiresAt: '',
    result: 'pending',
    restrictions: '',
    recommendations: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sst/medical-exams', {
        ...form,
        provider: form.provider || null,
        expiresAt: form.expiresAt || null,
        restrictions: form.restrictions || null,
        recommendations: form.recommendations || null,
      }),
    onSuccess: () => {
      toast.success('Examen registrado');
      void queryClient.invalidateQueries({ queryKey: ['sst'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar examen medico ocupacional</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colaborador" required>
            <EmployeePicker
              value={form.employeeId || null}
              onChange={(id) => setForm({ ...form, employeeId: id ?? '' })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value })}
              >
                {EXAM_KINDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Proveedor">
              <Input
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value })}
              />
            </Field>
            <Field label="Fecha de realizacion" required>
              <Input
                type="date"
                value={form.performedAt}
                onChange={(event) => setForm({ ...form, performedAt: event.target.value })}
              />
            </Field>
            <Field label="Vence">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Concepto de aptitud">
            <NativeSelect
              value={form.result}
              onChange={(event) => setForm({ ...form, result: event.target.value })}
            >
              {EXAM_RESULTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Restricciones" hint="Se almacena cifrado">
            <Textarea
              value={form.restrictions}
              onChange={(event) => setForm({ ...form, restrictions: event.target.value })}
              rows={2}
            />
          </Field>
          <Field label="Recomendaciones" hint="Se almacena cifrado">
            <Textarea
              value={form.recommendations}
              onChange={(event) => setForm({ ...form, recommendations: event.target.value })}
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
            disabled={!form.employeeId}
            onClick={() => create.mutate()}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- accidents ------------------------------- */

function AccidentsTab() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'accidents', page],
    queryFn: () => apiList<any>('/sst/accidents', { page, limit: 25 }),
    retry: false,
  });

  const columns: Array<Column<any>> = [
    { key: 'occurredAt', header: 'Ocurrio', render: (row) => formatDate(row.occurredAt) },
    { key: 'employee', header: 'Colaborador', render: (row) => row.employee?.fullName ?? '—' },
    {
      key: 'kind',
      header: 'Tipo',
      render: (row) => <Badge tone="muted">{statusLabel(row.kind)}</Badge>,
    },
    {
      key: 'severity',
      header: 'Gravedad',
      render: (row) => <Badge tone={statusTone(row.severity)}>{statusLabel(row.severity)}</Badge>,
    },
    { key: 'place', header: 'Lugar', hideOnMobile: true, render: (row) => row.place ?? '—' },
    { key: 'lostDays', header: 'Dias perdidos', hideOnMobile: true },
    {
      key: 'investigation',
      header: 'Investigacion',
      hideOnMobile: true,
      render: (row) =>
        row.investigation ? (
          <Badge tone="success">Registrada</Badge>
        ) : (
          <Badge tone="warning">Pendiente</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin accidentes ni incidentes registrados"
        toolbar={
          can('sst.accident.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <AlertTriangle className="h-4 w-4" />
              Reportar evento
            </Button>
          ) : null
        }
      />
      {creating ? <AccidentDialog open onOpenChange={() => setCreating(false)} /> : null}
    </div>
  );
}

function AccidentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    employeeId: '',
    kind: 'accident',
    occurredAt: new Date().toISOString().slice(0, 16),
    place: '',
    bodyPart: '',
    severity: 'low',
    description: '',
    furatNumber: '',
    lostDays: 0,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sst/accidents', {
        ...form,
        occurredAt: new Date(form.occurredAt).toISOString(),
        place: form.place || null,
        bodyPart: form.bodyPart || null,
        furatNumber: form.furatNumber || null,
        lostDays: Number(form.lostDays),
      }),
    onSuccess: () => {
      toast.success('Evento registrado');
      void queryClient.invalidateQueries({ queryKey: ['sst'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar accidente o incidente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colaborador" required>
            <EmployeePicker
              value={form.employeeId || null}
              onChange={(id) => setForm({ ...form, employeeId: id ?? '' })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de evento">
              <NativeSelect
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value })}
              >
                <option value="accident">Accidente de trabajo</option>
                <option value="incident">Incidente</option>
                <option value="occupational_disease">Enfermedad laboral</option>
              </NativeSelect>
            </Field>
            <Field label="Fecha y hora" required>
              <Input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
              />
            </Field>
            <Field label="Lugar">
              <Input
                value={form.place}
                onChange={(event) => setForm({ ...form, place: event.target.value })}
              />
            </Field>
            <Field label="Parte del cuerpo afectada">
              <Input
                value={form.bodyPart}
                onChange={(event) => setForm({ ...form, bodyPart: event.target.value })}
              />
            </Field>
            <Field label="Gravedad">
              <NativeSelect
                value={form.severity}
                onChange={(event) => setForm({ ...form, severity: event.target.value })}
              >
                <option value="low">Leve</option>
                <option value="medium">Moderada</option>
                <option value="high">Grave</option>
                <option value="critical">Mortal o critica</option>
              </NativeSelect>
            </Field>
            <Field label="Dias perdidos">
              <Input
                type="number"
                min={0}
                value={form.lostDays}
                onChange={(event) => setForm({ ...form, lostDays: Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Numero FURAT" hint="Informativo: el reporte legal se hace ante la ARL">
            <Input
              value={form.furatNumber}
              onChange={(event) => setForm({ ...form, furatNumber: event.target.value })}
            />
          </Field>
          <Field label="Descripcion de lo ocurrido" required>
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={4}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.employeeId || form.description.trim().length < 10}
            onClick={() => create.mutate()}
          >
            Registrar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ risk matrix ------------------------------- */

function RiskMatrixTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'risks', page],
    queryFn: () => apiList<any>('/sst/risks', { page, limit: 50 }),
    retry: false,
  });

  const rows = data?.data ?? [];

  // Probability x consequence grid, read the way GTC-45 draws the matrix:
  // rows go from the highest probability down, columns from mild to severe.
  const grid = React.useMemo(() => {
    const cells: Array<{ key: string; value: number; label?: string }> = [];
    for (let probability = 5; probability >= 1; probability -= 1) {
      for (let consequence = 1; consequence <= 5; consequence += 1) {
        const matching = rows.filter(
          (entry: any) => entry.probability === probability && entry.consequence === consequence,
        );
        cells.push({
          key: `P${probability}-C${consequence}`,
          value: matching.length,
          label: matching.length ? String(matching.length) : '',
        });
      }
    }
    return cells;
  }, [rows]);

  const columns: Array<Column<any>> = [
    { key: 'hazard', header: 'Peligro' },
    { key: 'hazardClass', header: 'Clasificacion', hideOnMobile: true },
    { key: 'risk', header: 'Riesgo', hideOnMobile: true },
    { key: 'exposedCount', header: 'Expuestos' },
    {
      key: 'riskLevel',
      header: 'Nivel',
      render: (row) => (
        <Badge
          tone={
            row.riskLevel === 'critico'
              ? 'danger'
              : row.riskLevel === 'alto'
                ? 'warning'
                : row.riskLevel === 'medio'
                  ? 'info'
                  : 'success'
          }
        >
          {statusLabel(row.riskLevel)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mapa de calor probabilidad × consecuencia</CardTitle>
          <CardDescription>Cantidad de peligros identificados en cada celda.</CardDescription>
        </CardHeader>
        <CardContent>
          <HeatGrid
            cells={grid}
            columns={5}
            rowLabels={['Prob. 5', 'Prob. 4', 'Prob. 3', 'Prob. 2', 'Prob. 1']}
            columnLabels={['Cons. 1', 'Cons. 2', 'Cons. 3', 'Cons. 4', 'Cons. 5']}
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={50}
        onPageChange={setPage}
        emptyTitle="Matriz de riesgos vacia"
        toolbar={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Agregar peligro
          </Button>
        }
      />

      {creating ? (
        <RiskDialog
          open
          onOpenChange={() => setCreating(false)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ['sst', 'risks'] })}
        />
      ) : null}
    </div>
  );
}

function RiskDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    hazard: '',
    hazardClass: 'biomecanico',
    risk: '',
    exposedCount: 1,
    probability: 2,
    consequence: 2,
    controls: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sst/risks', {
        ...form,
        exposedCount: Number(form.exposedCount),
        probability: Number(form.probability),
        consequence: Number(form.consequence),
        controls: form.controls || null,
      }),
    onSuccess: () => {
      toast.success('Peligro agregado a la matriz');
      onSaved();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  const score = Number(form.probability) * Number(form.consequence);
  const level = score >= 20 ? 'Critico' : score >= 12 ? 'Alto' : score >= 6 ? 'Medio' : 'Bajo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar peligro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Peligro" required>
            <Input
              value={form.hazard}
              onChange={(event) => setForm({ ...form, hazard: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clasificacion" required>
              <NativeSelect
                value={form.hazardClass}
                onChange={(event) => setForm({ ...form, hazardClass: event.target.value })}
              >
                <option value="biologico">Biologico</option>
                <option value="fisico">Fisico</option>
                <option value="quimico">Quimico</option>
                <option value="psicosocial">Psicosocial</option>
                <option value="biomecanico">Biomecanico</option>
                <option value="condiciones_seguridad">Condiciones de seguridad</option>
                <option value="fenomenos_naturales">Fenomenos naturales</option>
              </NativeSelect>
            </Field>
            <Field label="Expuestos">
              <Input
                type="number"
                min={0}
                value={form.exposedCount}
                onChange={(event) => setForm({ ...form, exposedCount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Probabilidad (1-5)">
              <Input
                type="number"
                min={1}
                max={5}
                value={form.probability}
                onChange={(event) => setForm({ ...form, probability: Number(event.target.value) })}
              />
            </Field>
            <Field label="Consecuencia (1-5)">
              <Input
                type="number"
                min={1}
                max={5}
                value={form.consequence}
                onChange={(event) => setForm({ ...form, consequence: Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Riesgo asociado" required>
            <Input
              value={form.risk}
              onChange={(event) => setForm({ ...form, risk: event.target.value })}
            />
          </Field>
          <Field label="Controles existentes">
            <Textarea
              value={form.controls}
              onChange={(event) => setForm({ ...form, controls: event.target.value })}
              rows={3}
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            Valoracion: <span className="font-medium text-foreground">{score}</span> · nivel {level}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.hazard.trim() || !form.risk.trim()}
            onClick={() => create.mutate()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- ppe ----------------------------------- */

function PpeTab() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    employeeId: '',
    ppeType: '',
    description: '',
    quantity: 1,
    deliveredAt: todayKey(),
    replacesAt: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'ppe', page],
    queryFn: () => apiList<any>('/sst/ppe', { page, limit: 25 }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sst/ppe', {
        ...form,
        description: form.description || null,
        replacesAt: form.replacesAt || null,
        quantity: Number(form.quantity),
      }),
    onSuccess: () => {
      toast.success('Entrega registrada', 'El acta queda disponible para firma.');
      void queryClient.invalidateQueries({ queryKey: ['sst', 'ppe'] });
      setCreating(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <DataTable
        columns={[
          {
            key: 'employee',
            header: 'Colaborador',
            render: (row: any) => row.employee?.fullName ?? '—',
          },
          { key: 'ppeType', header: 'Elemento' },
          { key: 'quantity', header: 'Cantidad' },
          {
            key: 'deliveredAt',
            header: 'Entregado',
            render: (row: any) => formatDate(row.deliveredAt),
          },
          {
            key: 'replacesAt',
            header: 'Reposicion',
            hideOnMobile: true,
            render: (row: any) => (row.replacesAt ? formatDate(row.replacesAt) : '—'),
          },
        ]}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin entregas de EPP"
        toolbar={
          can('sst.ppe.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <HardHat className="h-4 w-4" />
              Registrar entrega
            </Button>
          ) : null
        }
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrega de elementos de proteccion personal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Colaborador" required>
              <EmployeePicker
                value={form.employeeId || null}
                onChange={(id) => setForm({ ...form, employeeId: id ?? '' })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Elemento" required>
                <Input
                  value={form.ppeType}
                  onChange={(event) => setForm({ ...form, ppeType: event.target.value })}
                  placeholder="Casco, guantes, botas..."
                />
              </Field>
              <Field label="Cantidad">
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                />
              </Field>
              <Field label="Fecha de entrega" required>
                <Input
                  type="date"
                  value={form.deliveredAt}
                  onChange={(event) => setForm({ ...form, deliveredAt: event.target.value })}
                />
              </Field>
              <Field label="Proxima reposicion">
                <Input
                  type="date"
                  value={form.replacesAt}
                  onChange={(event) => setForm({ ...form, replacesAt: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripcion">
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.employeeId || !form.ppeType.trim()}
              onClick={() => create.mutate()}
            >
              Registrar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ inspections ------------------------------- */

function InspectionsTab() {
  const can = useAuth((state) => state.can);
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    title: '',
    kind: 'general',
    scheduledAt: todayKey(),
    performedAt: '',
    findings: '',
    actionPlan: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'inspections', page],
    queryFn: () => apiList<any>('/sst/inspections', { page, limit: 25 }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sst/inspections', {
        ...form,
        scheduledAt: form.scheduledAt || null,
        performedAt: form.performedAt || null,
        findings: form.findings || null,
        actionPlan: form.actionPlan || null,
      }),
    onSuccess: () => {
      toast.success('Inspeccion registrada');
      void queryClient.invalidateQueries({ queryKey: ['sst', 'inspections'] });
      setCreating(false);
    },
    onError: (error: Error) => toast.error('No fue posible registrar', error.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <DataTable
        columns={[
          { key: 'title', header: 'Inspeccion' },
          { key: 'kind', header: 'Tipo', hideOnMobile: true },
          {
            key: 'scheduledAt',
            header: 'Programada',
            render: (row: any) => (row.scheduledAt ? formatDate(row.scheduledAt) : '—'),
          },
          {
            key: 'performedAt',
            header: 'Realizada',
            render: (row: any) =>
              row.performedAt ? (
                formatDate(row.performedAt)
              ) : (
                <Badge tone="warning">Pendiente</Badge>
              ),
          },
        ]}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin inspecciones programadas"
        toolbar={
          can('sst.inspection.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva inspeccion
            </Button>
          ) : null
        }
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inspeccion de seguridad</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Titulo" required>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo">
                <Input
                  value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value })}
                />
              </Field>
              <Field label="Programada">
                <Input
                  type="date"
                  value={form.scheduledAt}
                  onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
                />
              </Field>
              <Field label="Realizada">
                <Input
                  type="date"
                  value={form.performedAt}
                  onChange={(event) => setForm({ ...form, performedAt: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Hallazgos">
              <Textarea
                value={form.findings}
                onChange={(event) => setForm({ ...form, findings: event.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Plan de accion">
              <Textarea
                value={form.actionPlan}
                onChange={(event) => setForm({ ...form, actionPlan: event.target.value })}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.title.trim()}
              onClick={() => create.mutate()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- committees ------------------------------- */

function CommitteesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['sst', 'committees'],
    queryFn: () => apiGet<any[]>('/sst/committees'),
    retry: false,
  });

  if (isLoading) return <p className="pt-4 text-sm text-muted-foreground">Cargando comites...</p>;
  if (!data?.length) {
    return (
      <div className="pt-4">
        <EmptyState
          icon={ShieldCheck}
          title="Sin comites registrados"
          description="COPASST y comite de convivencia laboral con su vigencia e integrantes."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      {data.map((committee: any) => (
        <Card key={committee.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{committee.name}</CardTitle>
                <CardDescription>
                  Vigencia {formatDate(committee.termStart)} — {formatDate(committee.termEnd)}
                </CardDescription>
              </div>
              <Badge tone={new Date(committee.termEnd) < new Date() ? 'danger' : 'success'}>
                {new Date(committee.termEnd) < new Date() ? 'Vencido' : 'Vigente'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Integrantes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {committee.members.map((member: any) => (
                  <Badge
                    key={member.id}
                    tone={member.representation === 'employer' ? 'info' : 'muted'}
                  >
                    {member.employee?.fullName ?? '—'}
                  </Badge>
                ))}
              </div>
            </div>
            {committee.minutes?.length ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ultimas actas
                </p>
                <div className="space-y-1">
                  {committee.minutes.map((minute: any) => (
                    <div key={minute.id} className="flex justify-between text-sm">
                      <span>Acta {minute.number}</span>
                      <span className="text-muted-foreground">
                        {formatDate(minute.meetingDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
