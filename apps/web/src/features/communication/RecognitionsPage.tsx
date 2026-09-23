import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Trophy } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface RecognitionRow {
  id: string;
  message: string;
  points: number;
  createdAt: string;
  from: { id: string; fullName: string } | null;
  to: { id: string; fullName: string };
  value: { id: string; name: string; color: string; icon: string | null } | null;
}

export function RecognitionsPage() {
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'recognitions'],
    queryFn: () => apiList<RecognitionRow>('/communication/recognitions', { limit: 50 }),
  });

  const { data: values } = useQuery({
    queryKey: ['communication', 'values'],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; color: string }>>('/communication/values'),
    retry: false,
  });

  const rows = data?.data ?? [];

  // Ranking of the people who received the most recognitions.
  const ranking = React.useMemo(() => {
    const counts = new Map<string, { name: string; count: number; points: number }>();
    for (const row of rows) {
      const current = counts.get(row.to.id) ?? { name: row.to.fullName, count: 0, points: 0 };
      current.count += 1;
      current.points += row.points;
      counts.set(row.to.id, current);
    }
    return [...counts.values()].sort((a, b) => b.points - a.points).slice(0, 8);
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconocimientos"
        description="Destaque el trabajo de sus companeros asociandolo a un valor corporativo."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Award className="h-4 w-4" />
            Reconocer a alguien
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(values ?? []).map((value) => (
          <Badge key={value.id} tone="muted" className="gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: value.color }} />
            {value.name}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState icon={Trophy} title="Sin reconocimientos" />
          ) : (
            rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex gap-3 p-4">
                  <Avatar name={row.to.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{row.from?.fullName ?? 'Alguien'}</span>{' '}
                      reconocio a <span className="font-medium">{row.to.fullName}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.value ? (
                        <Badge tone="muted" className="gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: row.value.color }}
                          />
                          {row.value.name}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(row.createdAt)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4" />
              Mas reconocidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((row, index) => (
              <div key={row.name} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                <Avatar name={row.name} size="sm" />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <Badge tone="muted">{row.count}</Badge>
              </div>
            ))}
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavia.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <RecognizeDialog open={createOpen} onOpenChange={setCreateOpen} values={values ?? []} />
    </div>
  );
}

function RecognizeDialog({
  open,
  onOpenChange,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    toEmployeeId: '',
    valueId: '',
    message: '',
    points: 10,
  });

  const { data: employees } = useQuery({
    queryKey: ['people', 'employees', 'recognize'],
    queryFn: () => apiList<{ id: string; fullName: string }>('/people/employees', { limit: 200 }),
    enabled: open,
    retry: false,
  });

  const recognize = useMutation({
    mutationFn: () =>
      apiPost('/communication/recognitions', {
        toEmployeeId: form.toEmployeeId,
        valueId: form.valueId || null,
        message: form.message,
        points: Number(form.points),
        isPublic: true,
      }),
    onSuccess: () => {
      toast.success('Reconocimiento publicado');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'recognitions'] });
      onOpenChange(false);
      setForm({ toEmployeeId: '', valueId: '', message: '', points: 10 });
    },
    onError: (error: Error) => toast.error('No fue posible reconocer', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconocer a un companero</DialogTitle>
          <DialogDescription>
            El reconocimiento se publica en el muro de la empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colaborador" required>
            <NativeSelect
              value={form.toEmployeeId}
              onChange={(event) => setForm({ ...form, toEmployeeId: event.target.value })}
            >
              <option value="">Seleccione...</option>
              {(employees?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Valor corporativo">
            <NativeSelect
              value={form.valueId}
              onChange={(event) => setForm({ ...form, valueId: event.target.value })}
            >
              <option value="">Sin valor asociado</option>
              {values.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Mensaje" required>
            <Textarea
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              rows={4}
              placeholder="Cuente que hizo y por que fue importante."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={recognize.isPending}
            disabled={!form.toEmployeeId || form.message.trim().length < 3}
            onClick={() => recognize.mutate()}
          >
            Publicar reconocimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
