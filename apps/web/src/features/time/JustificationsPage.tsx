import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Button,
  Field,
  NativeSelect,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@/components/ui/overlays';

interface Justification {
  id: string;
  reason: string;
  status: string;
  fileId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
  attendanceDay: {
    id: string;
    date: string;
    status: string;
    employee: { id: string; fullName: string };
  };
}

/** Attendance inconsistencies explained by employees, decided by their approvers. */
export function JustificationsPage() {
  const can = useAuth((state) => state.can);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('pending');
  const [deciding, setDeciding] = React.useState<{
    row: Justification;
    decision: 'approved' | 'rejected';
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['time', 'justifications', { page, status }],
    queryFn: () => apiList<Justification>('/time/justifications', { page, limit: 25, status }),
  });

  const columns: Array<Column<Justification>> = [
    {
      key: 'employee',
      header: 'Colaborador',
      render: (row) => <span className="font-medium">{row.attendanceDay.employee.fullName}</span>,
    },
    {
      key: 'date',
      header: 'Dia',
      render: (row) => (
        <span>
          {formatDate(row.attendanceDay.date)}{' '}
          <Badge tone={statusTone(row.attendanceDay.status)}>
            {statusLabel(row.attendanceDay.status)}
          </Badge>
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Justificacion',
      hideOnMobile: true,
      render: (row) => <span className="line-clamp-2 text-sm">{row.reason}</span>,
    },
    {
      key: 'createdAt',
      header: 'Enviada',
      hideOnMobile: true,
      render: (row) => formatDateTime(row.createdAt),
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
        row.status === 'pending' && can('time.justification.approve') ? (
          <span className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeciding({ row, decision: 'approved' })}
            >
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeciding({ row, decision: 'rejected' })}
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
          </span>
        ) : row.decisionComment ? (
          <span className="text-xs text-muted-foreground">{row.decisionComment}</span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Justificaciones de asistencia"
        description="Retardos, ausencias y salidas anticipadas explicadas por el colaborador. Al aprobar, la nota queda en el dia."
      />
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        emptyTitle="Sin justificaciones"
        emptyDescription="Cuando un colaborador justifique un dia aparecera aqui."
        toolbar={
          <NativeSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </NativeSelect>
        }
      />
      {deciding ? (
        <DecideDialog
          row={deciding.row}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </div>
  );
}

function DecideDialog({
  row,
  decision,
  onClose,
}: {
  row: Justification;
  decision: 'approved' | 'rejected';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = React.useState('');
  const decide = useMutation({
    mutationFn: () =>
      apiPost(`/time/justifications/${row.id}/decide`, { decision, comment: comment || null }),
    onSuccess: () => {
      toast.success(decision === 'approved' ? 'Justificacion aprobada' : 'Justificacion rechazada');
      void queryClient.invalidateQueries({ queryKey: ['time', 'justifications'] });
      void queryClient.invalidateQueries({ queryKey: ['time', 'attendance'] });
      onClose();
    },
    onError: (error: Error) => toast.error('No fue posible registrar la decision', error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {decision === 'approved' ? 'Aprobar justificacion' : 'Rechazar justificacion'}
          </DialogTitle>
          <DialogDescription>
            {row.attendanceDay.employee.fullName} · {formatDate(row.attendanceDay.date)}
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border bg-muted/40 p-3 text-sm">{row.reason}</p>
        <Field label="Comentario" hint="Lo vera el colaborador">
          <Textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={decide.isPending}
            variant={decision === 'approved' ? 'default' : 'destructive'}
            onClick={() => decide.mutate()}
          >
            {decision === 'approved' ? 'Aprobar' : 'Rechazar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
