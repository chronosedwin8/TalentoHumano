import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, BlockDocument, BlockType } from '@talento/shared';
import {
  AlignLeft,
  Code2,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Heading1,
  Image as ImageIcon,
  Layers,
  LayoutList,
  Link2,
  ListChecks,
  MessageSquareQuote,
  Minus,
  MonitorPlay,
  Plus,
  Save,
  SquareStack,
  Table2,
  Trash2,
  Video,
} from 'lucide-react';
import * as React from 'react';
import { BlockRenderer } from './BlockRenderer';
import { Button, Card, Input, Label, NativeSelect, Textarea } from '@/components/ui/primitives';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

interface BlockDefinition {
  type: BlockType;
  label: string;
  group: 'Texto' | 'Medios' | 'Interactivo' | 'Estructura';
  icon: React.ComponentType<{ className?: string }>;
  create: () => Block;
}

const newId = () => `b_${Math.random().toString(36).slice(2, 10)}`;

export const BLOCK_LIBRARY: BlockDefinition[] = [
  {
    type: 'paragraph',
    label: 'Parrafo',
    group: 'Texto',
    icon: AlignLeft,
    create: () => ({ id: newId(), type: 'paragraph', data: { html: '' } }),
  },
  {
    type: 'heading',
    label: 'Encabezado',
    group: 'Texto',
    icon: Heading1,
    create: () => ({ id: newId(), type: 'heading', data: { level: 2, text: 'Nuevo encabezado' } }),
  },
  {
    type: 'list',
    label: 'Lista',
    group: 'Texto',
    icon: LayoutList,
    create: () => ({
      id: newId(),
      type: 'list',
      data: { style: 'bullet', items: ['Primer elemento'] },
    }),
  },
  {
    type: 'quote',
    label: 'Cita',
    group: 'Texto',
    icon: MessageSquareQuote,
    create: () => ({ id: newId(), type: 'quote', data: { text: '', author: '' } }),
  },
  {
    type: 'callout',
    label: 'Aviso',
    group: 'Texto',
    icon: MessageSquareQuote,
    create: () => ({
      id: newId(),
      type: 'callout',
      data: { variant: 'info', title: '', text: '' },
    }),
  },
  {
    type: 'table',
    label: 'Tabla',
    group: 'Texto',
    icon: Table2,
    create: () => ({
      id: newId(),
      type: 'table',
      data: {
        rows: [
          ['Columna 1', 'Columna 2'],
          ['', ''],
        ],
      },
    }),
  },
  {
    type: 'code',
    label: 'Codigo',
    group: 'Texto',
    icon: Code2,
    create: () => ({ id: newId(), type: 'code', data: { language: 'text', code: '' } }),
  },
  {
    type: 'divider',
    label: 'Separador',
    group: 'Estructura',
    icon: Minus,
    create: () => ({ id: newId(), type: 'divider', data: {} }),
  },
  {
    type: 'accordion',
    label: 'Acordeon',
    group: 'Estructura',
    icon: SquareStack,
    create: () => ({
      id: newId(),
      type: 'accordion',
      data: { items: [{ title: 'Titulo', content: 'Contenido' }] },
    }),
  },
  {
    type: 'tabs',
    label: 'Pestanas',
    group: 'Estructura',
    icon: Layers,
    create: () => ({
      id: newId(),
      type: 'tabs',
      data: { items: [{ label: 'Pestana 1', content: 'Contenido' }] },
    }),
  },
  {
    type: 'image',
    label: 'Imagen',
    group: 'Medios',
    icon: ImageIcon,
    create: () => ({ id: newId(), type: 'image', data: { url: '', alt: '', caption: '' } }),
  },
  {
    type: 'video',
    label: 'Video',
    group: 'Medios',
    icon: Video,
    create: () => ({ id: newId(), type: 'video', data: { url: '' }, required: false }),
  },
  {
    type: 'file',
    label: 'Archivo descargable',
    group: 'Medios',
    icon: FileText,
    create: () => ({ id: newId(), type: 'file', data: { url: '', filename: '' } }),
  },
  {
    type: 'embed',
    label: 'Embed (YouTube, Genially, H5P...)',
    group: 'Medios',
    icon: MonitorPlay,
    create: () => ({ id: newId(), type: 'embed', data: { url: '', title: '' }, required: false }),
  },
  {
    type: 'quickQuestion',
    label: 'Pregunta rapida',
    group: 'Interactivo',
    icon: ListChecks,
    create: () => ({
      id: newId(),
      type: 'quickQuestion',
      required: true,
      data: { question: '', options: ['Si, lo comprendi', 'Necesito revisarlo de nuevo'] },
    }),
  },
  {
    type: 'flashcards',
    label: 'Tarjetas flip',
    group: 'Interactivo',
    icon: SquareStack,
    create: () => ({
      id: newId(),
      type: 'flashcards',
      data: { cards: [{ front: 'Pregunta', back: 'Respuesta' }] },
    }),
  },
  {
    type: 'timeline',
    label: 'Linea de tiempo',
    group: 'Interactivo',
    icon: Layers,
    create: () => ({
      id: newId(),
      type: 'timeline',
      data: { items: [{ title: 'Hito', date: '', description: '' }] },
    }),
  },
  {
    type: 'button',
    label: 'Boton / CTA',
    group: 'Interactivo',
    icon: Link2,
    create: () => ({
      id: newId(),
      type: 'button',
      data: { label: 'Abrir', url: '', newTab: true },
    }),
  },
  {
    type: 'gate',
    label: 'Antes de continuar',
    group: 'Interactivo',
    icon: ListChecks,
    create: () => ({
      id: newId(),
      type: 'gate',
      required: true,
      data: { text: 'Confirme que reviso el material antes de continuar.' },
    }),
  },
];

export interface BlockEditorProps {
  value: BlockDocument;
  onChange: (document: BlockDocument) => void;
  onSave?: (document: BlockDocument, publish: boolean) => void | Promise<void>;
  saving?: boolean;
  allowedEmbedDomains?: string[];
  /** Reusable company patterns that can be inserted. */
  patterns?: Array<{ id: string; name: string; blocks: BlockDocument }>;
  onSavePattern?: (name: string, blocks: Block[]) => void | Promise<void>;
  className?: string;
}

/**
 * Visual block editor shared by lessons, the wiki, feed posts and document
 * templates. Content is stored as a versioned block document, never raw HTML.
 */
export function BlockEditor({
  value,
  onChange,
  onSave,
  saving = false,
  allowedEmbedDomains,
  patterns = [],
  onSavePattern,
  className,
}: BlockEditorProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const blocks = value.blocks ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (next: Block[]) => onChange({ ...value, blocks: next });

  const addBlock = (definition: BlockDefinition, afterId?: string) => {
    const block = definition.create();
    const index = afterId ? blocks.findIndex((item) => item.id === afterId) : blocks.length - 1;
    const next = [...blocks];
    next.splice(index + 1, 0, block);
    update(next);
    setSelectedId(block.id);
  };

  const insertPattern = (pattern: { blocks: BlockDocument }) => {
    const cloned = (pattern.blocks.blocks ?? []).map((block) => ({ ...block, id: newId() }));
    update([...blocks, ...cloned]);
  };

  const patchBlock = (id: string, patch: Partial<Block>) => {
    update(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const removeBlock = (id: string) => {
    update(blocks.filter((block) => block.id !== id));
    setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const copy = { ...structuredClone(blocks[index]), id: newId() };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    update(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((block) => block.id === active.id);
    const to = blocks.findIndex((block) => block.id === over.id);
    update(arrayMove(blocks, from, to));
  };

  const groups = ['Texto', 'Medios', 'Interactivo', 'Estructura'] as const;

  return (
    <div className={cn('space-y-4', className)}>
      <Tabs defaultValue="edit">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4" />
              Vista previa
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            {patterns.length ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Layers className="h-4 w-4" />
                    Patrones
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground">
                    Insertar patron de empresa
                  </p>
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      type="button"
                      onClick={() => insertPattern(pattern)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {pattern.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            ) : null}

            {onSavePattern && blocks.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const name = window.prompt('Nombre del patron');
                  if (name) void onSavePattern(name, blocks);
                }}
              >
                Guardar como patron
              </Button>
            ) : null}

            {onSave ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  loading={saving}
                  onClick={() => void onSave(value, false)}
                >
                  <Save className="h-4 w-4" />
                  Guardar borrador
                </Button>
                <Button size="sm" loading={saving} onClick={() => void onSave(value, true)}>
                  Publicar
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <TabsContent value="edit">
          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    selected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onChange={(patch) => patchBlock(block.id, patch)}
                    onRemove={() => removeBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full border-dashed">
                  <Plus className="h-4 w-4" />
                  Agregar bloque
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-h-80 w-80 overflow-y-auto p-2">
                {groups.map((group) => (
                  <div key={group} className="mb-2">
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    {BLOCK_LIBRARY.filter((definition) => definition.group === group).map(
                      (definition) => {
                        const Icon = definition.icon;
                        return (
                          <button
                            key={definition.type}
                            type="button"
                            onClick={() => addBlock(definition)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {definition.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card className="p-6">
            <BlockRenderer document={value} options={{ allowedEmbedDomains, readOnly: true }} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SortableBlock({
  block,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const definition = BLOCK_LIBRARY.find((item) => item.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'card-surface p-3 transition-shadow',
        selected && 'ring-2 ring-primary',
        isDragging && 'opacity-60 shadow-lg',
      )}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Reordenar bloque"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {definition?.label ?? block.type}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {['video', 'embed', 'quickQuestion', 'gate'].includes(block.type) ? (
            <label className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(block.required)}
                onChange={(event) => onChange({ required: event.target.checked })}
                className="h-3.5 w-3.5 rounded border-input"
              />
              Obligatorio
            </label>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicar">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <BlockForm block={block} onChange={onChange} />
    </div>
  );
}

function setData(block: Block, patch: Record<string, unknown>): Partial<Block> {
  return { data: { ...(block.data ?? {}), ...patch } };
}

function BlockForm({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const data = (block.data ?? {}) as Record<string, any>;

  switch (block.type) {
    case 'heading':
      return (
        <div className="flex gap-2">
          <NativeSelect
            className="w-24"
            value={String(data.level ?? 2)}
            onChange={(event) => onChange(setData(block, { level: Number(event.target.value) }))}
          >
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                H{level}
              </option>
            ))}
          </NativeSelect>
          <Input
            value={data.text ?? ''}
            onChange={(event) => onChange(setData(block, { text: event.target.value }))}
            placeholder="Texto del encabezado"
          />
        </div>
      );

    case 'paragraph':
      return (
        <Textarea
          value={data.html ?? ''}
          onChange={(event) => onChange(setData(block, { html: event.target.value }))}
          placeholder="Escriba el parrafo. Puede usar <strong>, <em> y enlaces."
          rows={4}
        />
      );

    case 'list':
      return (
        <div className="space-y-2">
          <NativeSelect
            className="w-40"
            value={data.style ?? 'bullet'}
            onChange={(event) => onChange(setData(block, { style: event.target.value }))}
          >
            <option value="bullet">Vinetas</option>
            <option value="ordered">Numerada</option>
            <option value="task">Tareas</option>
          </NativeSelect>
          <Textarea
            value={(data.items ?? []).join('\n')}
            onChange={(event) =>
              onChange(setData(block, { items: event.target.value.split('\n').filter(Boolean) }))
            }
            placeholder="Un elemento por linea"
            rows={4}
          />
        </div>
      );

    case 'quote':
      return (
        <div className="space-y-2">
          <Textarea
            value={data.text ?? ''}
            onChange={(event) => onChange(setData(block, { text: event.target.value }))}
            placeholder="Texto de la cita"
            rows={3}
          />
          <Input
            value={data.author ?? ''}
            onChange={(event) => onChange(setData(block, { author: event.target.value }))}
            placeholder="Autor (opcional)"
          />
        </div>
      );

    case 'callout':
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <NativeSelect
              className="w-40"
              value={data.variant ?? 'info'}
              onChange={(event) => onChange(setData(block, { variant: event.target.value }))}
            >
              <option value="info">Informacion</option>
              <option value="success">Exito</option>
              <option value="warning">Advertencia</option>
              <option value="error">Error</option>
            </NativeSelect>
            <Input
              value={data.title ?? ''}
              onChange={(event) => onChange(setData(block, { title: event.target.value }))}
              placeholder="Titulo (opcional)"
            />
          </div>
          <Textarea
            value={data.text ?? ''}
            onChange={(event) => onChange(setData(block, { text: event.target.value }))}
            rows={2}
            placeholder="Mensaje"
          />
        </div>
      );

    case 'table':
      return (
        <Textarea
          value={(data.rows ?? []).map((row: string[]) => row.join(' | ')).join('\n')}
          onChange={(event) =>
            onChange(
              setData(block, {
                rows: event.target.value
                  .split('\n')
                  .map((line) => line.split('|').map((cell) => cell.trim())),
              }),
            )
          }
          rows={5}
          placeholder={'Encabezado 1 | Encabezado 2\nCelda 1 | Celda 2'}
        />
      );

    case 'code':
      return (
        <Textarea
          value={data.code ?? ''}
          onChange={(event) => onChange(setData(block, { code: event.target.value }))}
          rows={5}
          className="font-mono text-xs"
          placeholder="Codigo"
        />
      );

    case 'divider':
      return <p className="text-xs text-muted-foreground">Linea separadora.</p>;

    case 'image':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={data.url ?? ''}
            onChange={(event) => onChange(setData(block, { url: event.target.value }))}
            placeholder="URL de la imagen"
          />
          <Input
            value={data.alt ?? ''}
            onChange={(event) => onChange(setData(block, { alt: event.target.value }))}
            placeholder="Texto alternativo (accesibilidad)"
          />
          <Input
            value={data.caption ?? ''}
            onChange={(event) => onChange(setData(block, { caption: event.target.value }))}
            placeholder="Pie de foto"
          />
          <NativeSelect
            value={data.align ?? 'left'}
            onChange={(event) => onChange(setData(block, { align: event.target.value }))}
          >
            <option value="left">Izquierda</option>
            <option value="center">Centrada</option>
          </NativeSelect>
        </div>
      );

    case 'video':
    case 'audio':
      return (
        <Input
          value={data.url ?? ''}
          onChange={(event) => onChange(setData(block, { url: event.target.value }))}
          placeholder="URL del archivo"
        />
      );

    case 'file':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={data.url ?? ''}
            onChange={(event) => onChange(setData(block, { url: event.target.value }))}
            placeholder="URL del documento"
          />
          <Input
            value={data.filename ?? ''}
            onChange={(event) => onChange(setData(block, { filename: event.target.value }))}
            placeholder="Nombre visible"
          />
        </div>
      );

    case 'embed':
      return (
        <div className="space-y-2">
          <Input
            value={data.url ?? ''}
            onChange={(event) => onChange(setData(block, { url: event.target.value }))}
            placeholder="Pegue la URL (YouTube, Vimeo, Genially, H5P, Canva...)"
          />
          <Input
            value={data.title ?? ''}
            onChange={(event) => onChange(setData(block, { title: event.target.value }))}
            placeholder="Titulo del contenido"
          />
          <p className="text-xs text-muted-foreground">
            Solo se permiten dominios de la lista blanca configurada por la empresa.
          </p>
        </div>
      );

    case 'quickQuestion':
      return (
        <div className="space-y-2">
          <Input
            value={data.question ?? ''}
            onChange={(event) => onChange(setData(block, { question: event.target.value }))}
            placeholder="Pregunta de verificacion"
          />
          <Textarea
            value={(data.options ?? []).join('\n')}
            onChange={(event) =>
              onChange(setData(block, { options: event.target.value.split('\n').filter(Boolean) }))
            }
            rows={3}
            placeholder="Una opcion por linea"
          />
        </div>
      );

    case 'flashcards':
      return (
        <Textarea
          value={(data.cards ?? [])
            .map((card: { front: string; back: string }) => `${card.front} :: ${card.back}`)
            .join('\n')}
          onChange={(event) =>
            onChange(
              setData(block, {
                cards: event.target.value
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => {
                    const [front, back] = line.split('::');
                    return { front: (front ?? '').trim(), back: (back ?? '').trim() };
                  }),
              }),
            )
          }
          rows={4}
          placeholder={'Pregunta :: Respuesta'}
        />
      );

    case 'accordion':
    case 'tabs':
      return (
        <Textarea
          value={(data.items ?? [])
            .map(
              (item: { title?: string; label?: string; content: string }) =>
                `${item.title ?? item.label ?? ''} :: ${item.content ?? ''}`,
            )
            .join('\n')}
          onChange={(event) =>
            onChange(
              setData(block, {
                items: event.target.value
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => {
                    const [title, content] = line.split('::');
                    const key = block.type === 'tabs' ? 'label' : 'title';
                    return { [key]: (title ?? '').trim(), content: (content ?? '').trim() };
                  }),
              }),
            )
          }
          rows={4}
          placeholder={'Titulo :: Contenido'}
        />
      );

    case 'timeline':
      return (
        <Textarea
          value={(data.items ?? [])
            .map(
              (item: { title: string; date?: string; description?: string }) =>
                `${item.title} :: ${item.date ?? ''} :: ${item.description ?? ''}`,
            )
            .join('\n')}
          onChange={(event) =>
            onChange(
              setData(block, {
                items: event.target.value
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => {
                    const [title, date, description] = line.split('::');
                    return {
                      title: (title ?? '').trim(),
                      date: (date ?? '').trim(),
                      description: (description ?? '').trim(),
                    };
                  }),
              }),
            )
          }
          rows={4}
          placeholder={'Hito :: Fecha :: Descripcion'}
        />
      );

    case 'button':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={data.label ?? ''}
            onChange={(event) => onChange(setData(block, { label: event.target.value }))}
            placeholder="Texto del boton"
          />
          <Input
            value={data.url ?? ''}
            onChange={(event) => onChange(setData(block, { url: event.target.value }))}
            placeholder="Enlace"
          />
        </div>
      );

    case 'gate':
      return (
        <Textarea
          value={data.text ?? ''}
          onChange={(event) => onChange(setData(block, { text: event.target.value }))}
          rows={2}
          placeholder="Mensaje que debe confirmar el alumno"
        />
      );

    default:
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Contenido del bloque (JSON)</Label>
          <Textarea
            value={JSON.stringify(data, null, 2)}
            onChange={(event) => {
              try {
                onChange({ data: JSON.parse(event.target.value) });
              } catch {
                /* the user is still typing */
              }
            }}
            rows={4}
            className="font-mono text-xs"
          />
        </div>
      );
  }
}

export const EMPTY_DOCUMENT: BlockDocument = { version: 1, blocks: [] };
