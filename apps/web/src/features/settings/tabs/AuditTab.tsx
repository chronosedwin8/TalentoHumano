import { useQuery } from '@tanstack/react-query';
import { Eye, Lock } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiList } from '@/lib/api';
import { formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import { Badge, Card, CardContent, Input, NativeSelect } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface SensitiveLog {
  id: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  userId: string;
  createdAt: string;
}

export function AuditTab() {
  return (
    <Tabs defaultValue="bitacora">
      <TabsList>
        <TabsTrigger value="bitacora">Bitacora general</TabsTrigger>
        <TabsTrigger value="sensibles">Accesos a datos sensibles</TabsTrigger>
      </TabsList>
      <TabsContent value="bitacora">
        <AuditLogs />
      </TabsContent>
      <TabsContent value="sensibles">
        <SensitiveLogs />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */

function AuditLogs() {
  const [page, setPage] = React.useState(1);
  const [entityType, setEntityType] = React.useState('');
  const [action, setAction] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [detail, setDetail] = React.useState<AuditLog | null>(null);

  const { data: entityTypes } = useQuery({
    queryKey: ['audit', 'entity-types'],
    queryFn: () => apiGet<string[]>('/audit/entity-types'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'logs', { page, entityType, action, from, to }],
    queryFn: () =>
      apiList<AuditLog>('/audit/logs', { page, limit: 25, entityType, action, from, to }),
  });

  const columns: Array<Column<AuditLog>> = [
    { key: 'createdAt', header: 'Fecha', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actor',
      header: 'Usuario',
      render: (row) =>
        row.actor ? (
          <div className="min-w-0">
            <p className="truncate">
              {row.actor.firstName} {row.actor.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.actor.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">Sistema</span>
        ),
    },
    {
      key: 'action',
      header: 'Accion',
      render: (row) => <Badge tone={statusTone(row.action)}>{statusLabel(row.action)}</Badge>,
    },
    {
      key: 'entityType',
      header: 'Entidad',
      hideOnMobile: true,
      render: (row) => <span className="font-mono text-xs">{row.entityType}</span>,
    },
    {
      key: 'summary',
      header: 'Detalle',
      hideOnMobile: true,
      render: (row) => <span className="truncate">{row.summary ?? '—'}</span>,
    },
    {
      key: 'ipAddress',
      header: 'IP',
      hideOnMobile: true,
      render: (row) => <span className="font-mono text-xs">{row.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-3 pt-4">
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        onRowClick={(row) => setDetail(row)}
        emptyTitle="Sin registros de auditoria"
        toolbar={
          <>
            <NativeSelect
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              className="w-48"
            >
              <option value="">Todas las entidades</option>
              {(entityTypes ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">Toda accion</option>
              <option value="create">Crear</option>
              <option value="update">Editar</option>
              <option value="delete">Eliminar</option>
              <option value="login">Ingreso</option>
              <option value="export">Exportar</option>
              <option value="approve">Aprobar</option>
              <option value="reject">Rechazar</option>
            </NativeSelect>
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-36"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-36"
              aria-label="Hasta"
            />
          </>
        }
      />

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <Row label="Fecha" value={formatDateTime(detail.createdAt)} />
                <Row label="Accion" value={statusLabel(detail.action)} />
                <Row label="Entidad" value={detail.entityType} />
                <Row label="Id" value={detail.entityId ?? '—'} />
                <Row label="IP" value={detail.ipAddress ?? '—'} />
                <Row label="Navegador" value={detail.userAgent ?? '—'} />
              </div>
              {detail.changes ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cambios
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                    {JSON.stringify(detail.changes, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SensitiveLogs() {
  const [page, setPage] = React.useState(1);
  const [entityType, setEntityType] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'sensitive', page, entityType],
    queryFn: () =>
      apiList<SensitiveLog>('/audit/sensitive-access', { page, limit: 25, entityType }),
  });

  return (
    <div className="space-y-3 pt-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            Toda lectura de salarios, datos de salud, informacion bancaria, procesos disciplinarios
            y denuncias queda registrada aqui, con el usuario y el momento exacto.
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={[
          {
            key: 'createdAt',
            header: 'Fecha',
            render: (row: SensitiveLog) => formatDateTime(row.createdAt),
          },
          {
            key: 'entityType',
            header: 'Tipo de dato',
            render: (row: SensitiveLog) => (
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{row.entityType}</span>
              </span>
            ),
          },
          {
            key: 'entityId',
            header: 'Registro',
            hideOnMobile: true,
            render: (row: SensitiveLog) => (
              <span className="font-mono text-xs">{row.entityId ?? '—'}</span>
            ),
          },
          {
            key: 'reason',
            header: 'Motivo',
            hideOnMobile: true,
            render: (row: SensitiveLog) => row.reason ?? '—',
          },
        ]}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin accesos registrados"
        toolbar={
          <NativeSelect
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            className="w-56"
          >
            <option value="">Todos los tipos</option>
            <option value="employee_compensation">Compensacion</option>
            <option value="employee_bank">Datos bancarios</option>
            <option value="employee_health">Datos de salud</option>
            <option value="medical_exam">Examenes medicos</option>
            <option value="disciplinary_process">Procesos disciplinarios</option>
            <option value="ethics_report">Denuncias</option>
          </NativeSelect>
        }
      />
    </div>
  );
}
