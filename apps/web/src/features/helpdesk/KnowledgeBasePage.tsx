import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Eye, Plus } from 'lucide-react';
import * as React from 'react';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { apiGet, apiList, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { debounce, formatNumber } from '@/lib/utils';
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
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  blocks: BlockDocument;
  tags: string[];
  status: string;
  viewCount: number;
}

export function KnowledgeBasePage() {
  const can = useAuth((state) => state.can);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [reading, setReading] = React.useState<Article | null>(null);
  const [creating, setCreating] = React.useState(false);

  const pushSearch = React.useMemo(() => debounce((value: string) => setDebounced(value), 350), []);

  const { data, isLoading } = useQuery({
    queryKey: ['helpdesk', 'kb', debounced],
    queryFn: () => apiList<Article>('/helpdesk/kb', { search: debounced, limit: 60 }),
  });

  const articles = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de conocimiento"
        description="Respuestas a las preguntas frecuentes del equipo, antes de abrir un ticket."
        actions={
          can('helpdesk.kb.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nuevo articulo
            </Button>
          ) : null
        }
      />

      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          pushSearch(event.target.value);
        }}
        placeholder="Buscar en la base de conocimiento"
        className="max-w-xl"
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Sin articulos publicados"
          description="Documente aqui las respuestas que el equipo pregunta con mas frecuencia."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              role="button"
              tabIndex={0}
              onClick={() => setReading(article)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setReading(article);
              }}
              className="cursor-pointer transition-colors hover:border-primary/50"
            >
              <CardHeader>
                <CardTitle className="text-base">{article.title}</CardTitle>
                {article.summary ? (
                  <CardDescription className="line-clamp-3">{article.summary}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {article.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} tone="muted">
                    {tag}
                  </Badge>
                ))}
                <span className="ml-auto flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(article.viewCount)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reading ? <ReadDialog article={reading} onClose={() => setReading(null)} /> : null}
      {creating ? <ArticleDialog open onOpenChange={() => setCreating(false)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReadDialog({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{article.title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <BlockRenderer document={article.blocks} options={{ readOnly: true }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArticleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    title: '',
    summary: '',
    categoryId: '',
    tags: '',
    publish: true,
  });
  const [blocks, setBlocks] = React.useState<BlockDocument>(EMPTY_DOCUMENT);

  const { data: categories } = useQuery({
    queryKey: ['helpdesk', 'categories'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/helpdesk/categories'),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/helpdesk/kb', {
        title: form.title,
        summary: form.summary || null,
        categoryId: form.categoryId || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        blocks,
        publish: form.publish,
      }),
    onSuccess: () => {
      toast.success(form.publish ? 'Articulo publicado' : 'Articulo guardado como borrador');
      void queryClient.invalidateQueries({ queryKey: ['helpdesk', 'kb'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error('No fue posible guardar el articulo', error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nuevo articulo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Titulo" required>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <NativeSelect
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Sin categoria</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Etiquetas" hint="Separadas por coma">
              <Input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Resumen">
            <Textarea
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.publish}
              onCheckedChange={(checked) => setForm({ ...form, publish: checked === true })}
            />
            Publicar de inmediato
          </label>
          <div className="max-h-[45vh] overflow-y-auto rounded-md border p-2">
            <BlockEditor value={blocks} onChange={setBlocks} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.title.trim() || !blocks.blocks.length}
            onClick={() => create.mutate()}
          >
            Guardar articulo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
