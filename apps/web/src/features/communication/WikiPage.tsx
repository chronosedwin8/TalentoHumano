import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  NativeSelect,
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

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string[];
  viewCount: number;
  publishedAt: string | null;
  category: { id: string; name: string } | null;
}

export function WikiPage() {
  const [params, setParams] = useSearchParams();
  const can = useAuth((state) => state.can);
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const slug = params.get('slug');

  const { data: categories } = useQuery({
    queryKey: ['communication', 'wiki-categories'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/communication/wiki-categories'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'wiki', { search, categoryId }],
    queryFn: () => apiList<ArticleRow>('/communication/wiki', { search, categoryId, limit: 50 }),
  });

  const { data: article } = useQuery({
    queryKey: ['communication', 'wiki', slug],
    queryFn: () => apiGet<ArticleRow & { blocks: BlockDocument }>(`/communication/wiki/${slug}`),
    enabled: Boolean(slug),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiki y base de conocimiento"
        description="Politicas, procesos y guias internas de la empresa."
        actions={
          can('communication.wiki.create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo articulo
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar articulo"
              className="pl-9"
            />
          </div>
          <NativeSelect value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Todas las categorias</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>

          <Card>
            <CardContent className="space-y-1 p-2">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : rows.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Sin articulos.</p>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setParams({ slug: row.slug })}
                    className={cn(
                      'w-full rounded-md p-2 text-left text-sm transition-colors hover:bg-accent',
                      slug === row.slug && 'bg-accent font-medium',
                    )}
                  >
                    <p className="truncate">{row.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.category?.name ?? 'General'}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {article ? (
            <Card>
              <CardHeader>
                <CardTitle>{article.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone="muted">{article.category?.name ?? 'General'}</Badge>
                  <span>Publicado {formatDate(article.publishedAt)}</span>
                  <span>{article.viewCount} lecturas</span>
                </div>
              </CardHeader>
              <CardContent>
                <BlockRenderer document={article.blocks} options={{ readOnly: true }} />
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Seleccione un articulo"
              description="Elija un documento de la lista para leerlo."
            />
          )}
        </div>
      </div>

      <CreateArticleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories ?? []}
      />
    </div>
  );
}

function CreateArticleDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [blocks, setBlocks] = React.useState<BlockDocument>(EMPTY_DOCUMENT);

  const create = useMutation({
    mutationFn: (publish: boolean) =>
      apiPost('/communication/wiki', {
        title,
        summary: summary || null,
        categoryId: categoryId || null,
        blocks,
        tags: [],
        publish,
      }),
    onSuccess: () => {
      toast.success('Articulo guardado');
      void queryClient.invalidateQueries({ queryKey: ['communication', 'wiki'] });
      onOpenChange(false);
      setTitle('');
      setSummary('');
      setBlocks(EMPTY_DOCUMENT);
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Nuevo articulo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titulo" required>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Categoria">
              <NativeSelect
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sin categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Resumen">
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={2}
            />
          </Field>
          <BlockEditor value={blocks} onChange={setBlocks} />
        </div>
        <DialogFooter>
          <Button variant="outline" loading={create.isPending} onClick={() => create.mutate(false)}>
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
