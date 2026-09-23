import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus } from 'lucide-react';
import * as React from 'react';
import { apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface BenefitRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  provider: string | null;
  requiresEnrollment: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export function BenefitsPage() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'benefits'],
    queryFn: () => apiList<BenefitRow>('/communication/benefits', { limit: 50 }),
  });

  const enroll = useMutation({
    mutationFn: (benefitId: string) => apiPost(`/communication/benefits/${benefitId}/enroll`, {}),
    onSuccess: () => {
      toast.success('Solicitud enviada', 'Talento Humano revisara su inscripcion.');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'benefits'] });
    },
    onError: (error: Error) => toast.error('No fue posible inscribirse', error.message),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beneficios"
        description="Convenios, descuentos y programas de bienestar disponibles."
        actions={
          can('communication.benefit.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo beneficio
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Gift} title="Sin beneficios publicados" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((benefit) => (
            <Card key={benefit.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{benefit.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {benefit.provider ?? 'Beneficio interno'}
                    </p>
                  </div>
                  {benefit.category ? <Badge tone="muted">{benefit.category}</Badge> : null}
                </div>

                {benefit.description ? (
                  <p className="flex-1 text-sm text-muted-foreground">{benefit.description}</p>
                ) : null}

                {benefit.validTo ? (
                  <p className="text-xs text-muted-foreground">
                    Vigente hasta {formatDate(benefit.validTo)}
                  </p>
                ) : null}

                {benefit.requiresEnrollment ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={enroll.isPending && enroll.variables === benefit.id}
                    onClick={() => enroll.mutate(benefit.id)}
                  >
                    Solicitar inscripcion
                  </Button>
                ) : (
                  <Badge tone="success" className="w-fit">
                    Disponible para todos
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateBenefitDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateBenefitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: '',
    category: '',
    description: '',
    provider: '',
    requiresEnrollment: false,
    validFrom: '',
    validTo: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/communication/benefits', {
        ...form,
        category: form.category || null,
        description: form.description || null,
        provider: form.provider || null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      }),
    onSuccess: () => {
      toast.success('Beneficio publicado');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'benefits'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible crear el beneficio', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo beneficio</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
          </Field>
          <Field label="Proveedor">
            <Input
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}
            />
          </Field>
          <Field label="Vigente desde">
            <Input
              type="date"
              value={form.validFrom}
              onChange={(event) => setForm({ ...form, validFrom: event.target.value })}
            />
          </Field>
          <Field label="Vigente hasta">
            <Input
              type="date"
              value={form.validTo}
              onChange={(event) => setForm({ ...form, validTo: event.target.value })}
            />
          </Field>
          <Field label="Descripcion" className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.requiresEnrollment}
              onChange={(event) => setForm({ ...form, requiresEnrollment: event.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Requiere inscripcion del colaborador
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.name.trim()}
            onClick={() => create.mutate()}
          >
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
