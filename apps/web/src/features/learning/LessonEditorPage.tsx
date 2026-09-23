import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, History } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlockEditor, EMPTY_DOCUMENT } from '@/components/blocks/BlockEditor';
import { apiGet, apiPost } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface Lesson {
  id: string;
  title: string;
  kind: string;
  module: { id: string; title: string; courseId: string };
  content: {
    blocks: BlockDocument;
    draftBlocks: BlockDocument | null;
    version: number;
    isPublished: boolean;
    updatedAt: string;
  } | null;
}

export function LessonEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'lesson', id],
    queryFn: () => apiGet<Lesson>(`/learning/lessons/${id}`),
    enabled: Boolean(id),
  });

  const { data: versions } = useQuery({
    queryKey: ['learning', 'lesson', id, 'versions'],
    queryFn: () =>
      apiGet<Array<{ id: string; version: number; changeNote: string | null; createdAt: string }>>(
        `/learning/lessons/${id}/versions`,
      ),
    enabled: Boolean(id),
    retry: false,
  });

  const { data: providers } = useQuery({
    queryKey: ['learning', 'embed-providers'],
    queryFn: () =>
      apiGet<Array<{ domain: string; isActive: boolean }>>('/learning/embed-providers'),
    retry: false,
  });

  const { data: patterns } = useQuery({
    queryKey: ['learning', 'patterns'],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; blocks: BlockDocument }>>('/learning/patterns'),
    retry: false,
  });

  const [document, setDocument] = React.useState<BlockDocument>(EMPTY_DOCUMENT);
  const [dirty, setDirty] = React.useState(false);

  // The server copy seeds the editor once per lesson. After that the editor
  // is the source of truth: the autosave invalidates the query, and syncing
  // again from the refetch would overwrite what was typed in between.
  const seededFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (data?.content && seededFor.current !== id) {
      seededFor.current = id ?? null;
      setDocument((data.content.draftBlocks ?? data.content.blocks) as BlockDocument);
    }
  }, [data?.content, id]);

  const save = useMutation({
    mutationFn: ({ blocks, publish }: { blocks: BlockDocument; publish: boolean }) =>
      apiPost(`/learning/lessons/${id}/content`, {
        blocks,
        publish,
        changeNote: publish ? 'Publicacion desde el editor' : null,
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.publish ? 'Contenido publicado' : 'Borrador guardado');
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['learning', 'lesson', id] });
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  const savePattern = useMutation({
    mutationFn: ({ name, blocks }: { name: string; blocks: BlockDocument }) =>
      apiPost('/learning/patterns', { name, blocks, isSynced: false }),
    onSuccess: () => {
      toast.success('Patron guardado');
      void queryClient.invalidateQueries({ queryKey: ['learning', 'patterns'] });
    },
  });

  // Autosave the draft a few seconds after the last edit.
  React.useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      save.mutate({ blocks: document, publish: false });
    }, 8000);
    return () => clearTimeout(timer);
  }, [document, dirty]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/learning/courses/${data.module.courseId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al curso
      </Button>

      <PageHeader
        title={data.title}
        description={`${data.module.title} · editor de contenido por bloques`}
        actions={
          data.content ? (
            <Badge tone={data.content.isPublished ? 'success' : 'warning'}>
              {data.content.isPublished
                ? `Version ${data.content.version} publicada`
                : 'Borrador sin publicar'}
            </Badge>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <BlockEditor
            value={document}
            onChange={(next) => {
              setDocument(next);
              setDirty(true);
            }}
            onSave={(blocks, publish) => save.mutate({ blocks, publish })}
            saving={save.isPending}
            allowedEmbedDomains={(providers ?? []).filter((p) => p.isActive).map((p) => p.domain)}
            patterns={patterns ?? []}
            onSavePattern={(name, blocks) =>
              savePattern.mutate({ name, blocks: { version: 1, blocks } })
            }
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Versiones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(versions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aun no hay versiones publicadas.</p>
              ) : (
                versions?.map((version) => (
                  <div key={version.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Version {version.version}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={async () => {
                          await apiPost(
                            `/learning/lessons/${id}/versions/${version.version}/restore`,
                            {},
                          );
                          toast.success(`Version ${version.version} restaurada`);
                          void queryClient.invalidateQueries({
                            queryKey: ['learning', 'lesson', id],
                          });
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                    <p className="text-muted-foreground">{formatDateTime(version.createdAt)}</p>
                    {version.changeNote ? (
                      <p className="mt-0.5 text-muted-foreground">{version.changeNote}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dominios permitidos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {(providers ?? [])
                .filter((provider) => provider.isActive)
                .slice(0, 16)
                .map((provider) => (
                  <Badge key={provider.domain} tone="muted" className="text-[10px]">
                    {provider.domain}
                  </Badge>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
