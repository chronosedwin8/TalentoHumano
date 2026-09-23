import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Heart, MessageCircle, Plus, Send } from 'lucide-react';
import * as React from 'react';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/utils';
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

interface PostRow {
  id: string;
  title: string;
  kind: string;
  excerpt: string | null;
  blocks: BlockDocument;
  isPinned: boolean;
  requiresAck: boolean;
  publishedAt: string | null;
  status: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  myReactions: string[];
  _count: { comments: number; reactions: number; reads: number };
}

export function FeedPage() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'feed'],
    queryFn: () => apiList<PostRow>('/communication/feed', { limit: 25 }),
  });

  const react = useMutation({
    mutationFn: (postId: string) =>
      apiPost(`/communication/posts/${postId}/reactions`, { emoji: 'like' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['communication', 'feed'] }),
  });

  const acknowledge = useMutation({
    mutationFn: (postId: string) => apiPost(`/communication/posts/${postId}/acknowledge`, {}),
    onSuccess: () => {
      toast.success('Lectura confirmada');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'feed'] });
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Muro de la empresa"
        description="Noticias, comunicados y eventos con confirmacion de lectura."
        actions={
          can('communication.post.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva publicacion
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin publicaciones" description="Aun no hay novedades publicadas." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {rows.map((post) => (
            <Card key={post.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {post.isPinned ? <Badge tone="info">Fijado</Badge> : null}
                  {post.requiresAck ? <Badge tone="warning">Requiere acuse</Badge> : null}
                  <Badge tone="muted">{post.kind}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(post.publishedAt)}
                  </span>
                </div>

                <h2 className="text-lg font-semibold">{post.title}</h2>
                <BlockRenderer document={post.blocks} options={{ readOnly: true }} />

                <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
                  <Button
                    variant={post.myReactions.includes('like') ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => react.mutate(post.id)}
                  >
                    <Heart className="h-4 w-4" />
                    {post._count.reactions}
                  </Button>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    {post._count.comments}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {post._count.reads} lecturas
                  </span>

                  {post.requiresAck ? (
                    <Button
                      size="sm"
                      variant={post.acknowledgedAt ? 'outline' : 'default'}
                      className="ml-auto"
                      disabled={Boolean(post.acknowledgedAt)}
                      onClick={() => acknowledge.mutate(post.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {post.acknowledgedAt ? 'Lectura confirmada' : 'Confirmar lectura'}
                    </Button>
                  ) : null}
                </div>

                <CommentBox postId={post.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePostDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CommentBox({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = React.useState('');

  const comment = useMutation({
    mutationFn: () => apiPost(`/communication/posts/${postId}/comments`, { body }),
    onSuccess: () => {
      setBody('');
      toast.success('Comentario publicado');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'feed'] });
    },
  });

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) comment.mutate();
      }}
    >
      <Input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escriba un comentario"
        className="h-9"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        loading={comment.isPending}
        disabled={!body.trim()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

function CreatePostDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [excerpt, setExcerpt] = React.useState('');
  const [kind] = React.useState('news');
  const [requiresAck, setRequiresAck] = React.useState(false);
  const [blocks, setBlocks] = React.useState<BlockDocument>(EMPTY_DOCUMENT);

  const create = useMutation({
    mutationFn: async (publish: boolean) => {
      const post = await apiPost<{ id: string }>('/communication/posts', {
        title,
        kind,
        blocks,
        excerpt: excerpt || null,
        isPinned: false,
        requiresAck,
        allowComments: true,
        allowReactions: true,
        audiences: [{ targetType: 'all' }],
      });
      if (publish) await apiPost(`/communication/posts/${post.id}/publish`, {});
      return post;
    },
    onSuccess: (_result, publish) => {
      toast.success(publish ? 'Publicacion enviada a la audiencia' : 'Borrador guardado');
      void queryClient.invalidateQueries({ queryKey: ['communication'] });
      onOpenChange(false);
      setTitle('');
      setExcerpt('');
      setBlocks(EMPTY_DOCUMENT);
    },
    onError: (error: Error) => toast.error('No fue posible publicar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Nueva publicacion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Resumen">
            <Textarea
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(event) => setRequiresAck(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Requiere confirmacion de lectura
          </label>

          <BlockEditor value={blocks} onChange={setBlocks} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => create.mutate(false)} loading={create.isPending}>
            Guardar borrador
          </Button>
          <Button
            loading={create.isPending}
            disabled={!title.trim()}
            onClick={() => create.mutate(true)}
          >
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
