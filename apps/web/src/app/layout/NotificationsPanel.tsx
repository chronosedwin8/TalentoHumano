import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiList, apiPost } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  eventKey: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => apiList<NotificationRow>('/notifications', { limit: 30 }),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/notifications/read', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rows = data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Notificaciones</DialogTitle>
          <DialogDescription>Novedades, aprobaciones y recordatorios.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
            disabled={!rows.some((row) => !row.readAt)}
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como leidas
          </Button>
        </div>

        <div className="-mx-2 max-h-[55vh] space-y-1 overflow-y-auto px-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))
          ) : rows.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Sin notificaciones"
              description="Cuando ocurra algo relevante lo vera aqui."
            />
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  if (row.url) {
                    onOpenChange(false);
                    navigate(row.url);
                  }
                }}
                className="flex w-full gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    row.readAt ? 'bg-transparent' : 'bg-primary'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{row.title}</p>
                  {row.body ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(row.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
