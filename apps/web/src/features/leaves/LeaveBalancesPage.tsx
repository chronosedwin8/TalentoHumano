import { balanceAdjustmentSchema } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import { Badge, Button, Field, Input, PageHeader, Textarea } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface BalanceRow {
  employee: { id: string; fullName: string; employeeCode: string; hiredAt: string };
  balance: {
    year: number;
    accruedDays: number;
    takenDays: number;
    pendingDays: number;
    adjustedDays: number;
    carryOverDays: number;
    availableDays: number;
  } | null;
}

export function LeaveBalancesPage() {
  const can = useAuth((state) => state.can);
  const [year] = React.useState(new Date().getUTCFullYear());
  const [search, setSearch] = React.useState('');
  const [adjusting, setAdjusting] = React.useState<BalanceRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'balances', year],
    queryFn: () => apiGet<BalanceRow[]>('/leaves/balances', { year }),
  });

  const rows = React.useMemo(() => {
    const all = data ?? [];
    if (!search.trim()) return all;
    const term = search.toLowerCase();
    return all.filter(
      (row) =>
        row.employee.fullName.toLowerCase().includes(term) ||
        row.employee.employeeCode.toLowerCase().includes(term),
    );
  }, [data, search]);

  const columns: Array<Column<BalanceRow>> = [
    {
      key: 'employee',
      header: 'Colaborador',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.employee.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {row.employee.employeeCode} · ingreso {formatDate(row.employee.hiredAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'accrued',
      header: 'Causados',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums">{row.balance?.accruedDays ?? 0}</span>,
    },
    {
      key: 'taken',
      header: 'Disfrutados',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums">{row.balance?.takenDays ?? 0}</span>,
    },
    {
      key: 'pending',
      header: 'En tramite',
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums">{row.balance?.pendingDays ?? 0}</span>,
    },
    {
      key: 'available',
      header: 'Disponibles',
      render: (row) => {
        const value = row.balance?.availableDays ?? 0;
        const risk = value >= 30;
        return (
          <span className="flex items-center gap-1.5">
            <span className={`font-semibold tabular-nums ${risk ? 'text-amber-600' : ''}`}>
              {value}
            </span>
            {risk ? (
              <Badge tone="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Acumulacion
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        can('leaves.balance.adjust') ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setAdjusting(row);
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Ajustar
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saldos de vacaciones"
        description={`Ano ${year}. Colombia: 15 dias habiles por ano trabajado. Solo control de dias, nunca valores monetarios.`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(row) => row.employee.id}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar colaborador"
        emptyTitle="Sin saldos calculados"
      />

      <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} year={year} />
    </div>
  );
}

function AdjustDialog({
  row,
  onClose,
  year,
}: {
  row: BalanceRow | null;
  onClose: () => void;
  year: number;
}) {
  const queryClient = useQueryClient();
  const [days, setDays] = React.useState('1');
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const adjust = useMutation({
    mutationFn: () =>
      apiPost('/leaves/balances/adjust', {
        employeeId: row?.employee.id,
        days: Number(days),
        reason,
        year,
      }),
    onSuccess: () => {
      toast.success('Saldo ajustado', 'El movimiento quedo registrado en auditoria.');
      void queryClient.invalidateQueries({ queryKey: ['leaves', 'balances'] });
      onClose();
      setReason('');
      setDays('1');
    },
    onError: (caught: Error) => setError(caught.message),
  });

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>
            {row?.employee.fullName} · el ajuste queda auditado con su usuario y motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Dias (use negativo para descontar)" required>
            <Input
              type="number"
              step="0.5"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </Field>
          <Field label="Motivo" required>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Ej.: reconocimiento de dias pendientes del ano anterior"
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={adjust.isPending}
            onClick={() => {
              setError(null);
              const parsed = balanceAdjustmentSchema.safeParse({
                employeeId: row?.employee.id,
                days: Number(days),
                reason,
                year,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Revise los datos');
                return;
              }
              adjust.mutate();
            }}
          >
            Aplicar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
