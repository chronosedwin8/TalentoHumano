import type { Block, BlockDocument } from '@talento/shared';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Lock,
  TriangleAlert,
} from 'lucide-react';
import * as React from 'react';
import { Badge, Button, Card, Progress } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

/** Domains the renderer is allowed to embed; provided by the API. */
export interface RendererOptions {
  allowedEmbedDomains?: string[];
  /** Interactive blocks report completion so lesson progress can advance. */
  onBlockComplete?: (blockId: string) => void;
  completedBlocks?: Record<string, boolean>;
  readOnly?: boolean;
}

export const BASE_ALLOWED = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'player.vimeo.com',
  'loom.com',
  'genial.ly',
  'view.genially.com',
  'h5p.org',
  'h5p.com',
  'docs.google.com',
  'slides.google.com',
  'forms.gle',
  'canva.com',
  'figma.com',
  'miro.com',
  'padlet.com',
  'wordwall.net',
  'kahoot.it',
  'quizizz.com',
  'open.spotify.com',
  'soundcloud.com',
  'codepen.io',
  'menti.com',
];

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'a',
      'code',
      'mark',
      'span',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'sub',
      'sup',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
  });
}

export function isAllowedEmbed(url: string, allowed: string[]): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/** Turns a watch URL into its embeddable form for the common providers. */
export function toEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' && parsed.searchParams.get('v')) {
      return `https://www.youtube-nocookie.com/embed/${parsed.searchParams.get('v')}`;
    }
    if (host === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed${parsed.pathname}`;
    }
    if (host === 'vimeo.com') {
      return `https://player.vimeo.com/video${parsed.pathname}`;
    }
    if (host === 'loom.com' && parsed.pathname.startsWith('/share/')) {
      return url.replace('/share/', '/embed/');
    }
    return url;
  } catch {
    return url;
  }
}

export function BlockRenderer({
  document: blockDocument,
  options = {},
  className,
}: {
  document: BlockDocument | null | undefined;
  options?: RendererOptions;
  className?: string;
}) {
  const blocks = blockDocument?.blocks ?? [];
  if (!blocks.length) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Sin contenido todavia.</p>;
  }
  return (
    <div className={cn('space-y-4', className)}>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} options={options} />
      ))}
    </div>
  );
}

function BlockView({ block, options }: { block: Block; options: RendererOptions }) {
  const data = (block.data ?? {}) as Record<string, any>;
  const allowed = options.allowedEmbedDomains?.length ? options.allowedEmbedDomains : BASE_ALLOWED;

  switch (block.type) {
    case 'heading': {
      const level = Math.min(4, Math.max(1, Number(data.level ?? 2)));
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      const sizes = {
        1: 'text-2xl font-bold',
        2: 'text-xl font-semibold',
        3: 'text-lg font-semibold',
        4: 'text-base font-semibold',
      } as const;
      return <Tag className={cn('tracking-tight', sizes[level as 1 | 2 | 3 | 4])}>{data.text}</Tag>;
    }

    case 'paragraph':
      return (
        <div
          className="prose-sm max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: sanitize(String(data.html ?? data.text ?? '')) }}
        />
      );

    case 'list': {
      const items: string[] = Array.isArray(data.items) ? data.items : [];
      if (data.style === 'task') {
        return (
          <ul className="space-y-1.5 text-sm">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      }
      const Tag = data.style === 'ordered' ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'space-y-1 pl-5 text-sm',
            data.style === 'ordered' ? 'list-decimal' : 'list-disc',
          )}
        >
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </Tag>
      );
    }

    case 'quote':
      return (
        <blockquote className="border-l-4 border-primary/40 pl-4 text-sm italic text-muted-foreground">
          {data.text}
          {data.author ? (
            <footer className="mt-1 text-xs not-italic">— {data.author}</footer>
          ) : null}
        </blockquote>
      );

    case 'callout': {
      const variants = {
        info: {
          icon: Info,
          className: 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200',
        },
        success: {
          icon: CheckCircle2,
          className:
            'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
        },
        warning: {
          icon: TriangleAlert,
          className: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
        },
        error: {
          icon: AlertCircle,
          className: 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200',
        },
      } as const;
      const variant = variants[(data.variant as keyof typeof variants) ?? 'info'] ?? variants.info;
      const Icon = variant.icon;
      return (
        <div className={cn('flex gap-3 rounded-lg border p-4 text-sm', variant.className)}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            {data.title ? <p className="font-semibold">{data.title}</p> : null}
            <p>{data.text}</p>
          </div>
        </div>
      );
    }

    case 'table': {
      const rows: string[][] = Array.isArray(data.rows) ? data.rows : [];
      const [header, ...body] = rows;
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            {header ? (
              <thead className="bg-muted/50">
                <tr>
                  {header.map((cell, index) => (
                    <th key={index} className="px-3 py-2 text-left font-semibold">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody className="divide-y">
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
          <code>{String(data.code ?? '')}</code>
        </pre>
      );

    case 'divider':
      return <hr className="border-border" />;

    case 'columns': {
      const columns: Block[][] = Array.isArray(data.columns) ? data.columns : [];
      return (
        <div
          className={cn(
            'grid gap-4',
            columns.length === 2 && 'md:grid-cols-2',
            columns.length === 3 && 'md:grid-cols-3',
            columns.length >= 4 && 'md:grid-cols-4',
          )}
        >
          {columns.map((column, index) => (
            <div key={index} className="space-y-3">
              {(column ?? []).map((child) => (
                <BlockView key={child.id} block={child} options={options} />
              ))}
            </div>
          ))}
        </div>
      );
    }

    case 'accordion': {
      const items: Array<{ title: string; content: string }> = Array.isArray(data.items)
        ? data.items
        : [];
      return (
        <div className="divide-y rounded-lg border">
          {items.map((item, index) => (
            <details key={index} className="group p-4">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                {item.title}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div
                className="mt-2 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: sanitize(item.content ?? '') }}
              />
            </details>
          ))}
        </div>
      );
    }

    case 'image':
      return (
        <figure className="space-y-2">
          <img
            src={String(data.url ?? '')}
            alt={String(data.alt ?? '')}
            className={cn('rounded-lg border', data.align === 'center' && 'mx-auto')}
            style={{ maxWidth: data.width ? `${data.width}px` : undefined }}
            loading="lazy"
          />
          {data.caption ? (
            <figcaption className="text-center text-xs text-muted-foreground">
              {data.caption}
            </figcaption>
          ) : null}
        </figure>
      );

    case 'gallery': {
      const images: Array<{ url: string; alt?: string }> = Array.isArray(data.images)
        ? data.images
        : [];
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {images.map((image, index) => (
            <img
              key={index}
              src={image.url}
              alt={image.alt ?? ''}
              className="aspect-video w-full rounded-lg border object-cover"
              loading="lazy"
            />
          ))}
        </div>
      );
    }

    case 'video':
      return (
        <div className="space-y-2">
          <video
            controls
            className="w-full rounded-lg border"
            src={String(data.hlsUrl ?? data.url ?? '')}
            onEnded={() => options.onBlockComplete?.(block.id)}
          />
          {block.required ? (
            <p className="text-xs text-muted-foreground">
              Debe ver el video completo para avanzar en la leccion.
            </p>
          ) : null}
        </div>
      );

    case 'audio':
      return <audio controls className="w-full" src={String(data.url ?? '')} />;

    case 'file':
      return (
        <a
          href={String(data.url ?? '#')}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent"
        >
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {data.filename ?? 'Documento'}
          </span>
          <span className="text-xs text-muted-foreground">Descargar</span>
        </a>
      );

    case 'embed': {
      const url = String(data.url ?? '');
      if (!url) return null;
      if (!isAllowedEmbed(url, allowed)) {
        return (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Lock className="h-4 w-4" />
            <span>
              El dominio de este contenido no esta autorizado por la empresa.{' '}
              <a href={url} target="_blank" rel="noreferrer" className="underline">
                Abrir en una pestana nueva
              </a>
            </span>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <div className="aspect-video overflow-hidden rounded-lg border">
            <iframe
              src={toEmbedUrl(url)}
              title={String(data.title ?? 'Contenido embebido')}
              className="h-full w-full"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              onLoad={() => {
                if (block.required) options.onBlockComplete?.(block.id);
              }}
            />
          </div>
          {data.caption ? <p className="text-xs text-muted-foreground">{data.caption}</p> : null}
        </div>
      );
    }

    case 'quickQuestion':
      return <QuickQuestion block={block} options={options} />;

    case 'flashcards': {
      const cards: Array<{ front: string; back: string }> = Array.isArray(data.cards)
        ? data.cards
        : [];
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card, index) => (
            <Flashcard key={index} front={card.front} back={card.back} />
          ))}
        </div>
      );
    }

    case 'tabs': {
      const items: Array<{ label: string; content: string }> = Array.isArray(data.items)
        ? data.items
        : [];
      if (!items.length) return null;
      return (
        <Tabs defaultValue="0">
          <TabsList>
            {items.map((item, index) => (
              <TabsTrigger key={index} value={String(index)}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((item, index) => (
            <TabsContent key={index} value={String(index)}>
              <div
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: sanitize(item.content ?? '') }}
              />
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    case 'button':
      return (
        <Button asChild variant={data.variant === 'outline' ? 'outline' : 'default'}>
          <a
            href={String(data.url ?? '#')}
            target={data.newTab ? '_blank' : undefined}
            rel="noreferrer"
          >
            {data.label ?? 'Abrir'}
          </a>
        </Button>
      );

    case 'timeline': {
      const items: Array<{ title: string; date?: string; description?: string }> = Array.isArray(
        data.items,
      )
        ? data.items
        : [];
      return (
        <ol className="relative space-y-4 border-l pl-6">
          {items.map((item, index) => (
            <li key={index} className="relative">
              <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full bg-primary" />
              <p className="text-sm font-semibold">{item.title}</p>
              {item.date ? <p className="text-xs text-muted-foreground">{item.date}</p> : null}
              {item.description ? <p className="mt-1 text-sm">{item.description}</p> : null}
            </li>
          ))}
        </ol>
      );
    }

    case 'gate':
      return (
        <Card className="border-dashed p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4" />
            Antes de continuar
          </div>
          <p className="mt-1 text-muted-foreground">
            {data.text ?? 'Complete la actividad anterior.'}
          </p>
          {!options.readOnly ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => options.onBlockComplete?.(block.id)}
              disabled={options.completedBlocks?.[block.id]}
            >
              {options.completedBlocks?.[block.id] ? 'Completado' : 'Confirmo que lo revise'}
            </Button>
          ) : null}
        </Card>
      );

    case 'quiz':
    case 'pulseSurvey':
      return (
        <Card className="p-4 text-sm">
          <Badge tone="info">{block.type === 'quiz' ? 'Cuestionario' : 'Encuesta pulse'}</Badge>
          <p className="mt-2 font-medium">{data.title ?? 'Actividad'}</p>
          <p className="text-muted-foreground">
            {block.type === 'quiz'
              ? 'Responda el cuestionario desde la evaluacion de la leccion.'
              : 'Responda la encuesta desde el modulo de encuestas.'}
          </p>
        </Card>
      );

    case 'pattern':
      return (
        <div className="space-y-3">
          {(block.children ?? []).map((child) => (
            <BlockView key={child.id} block={child} options={options} />
          ))}
        </div>
      );

    default:
      return null;
  }
}

function QuickQuestion({ block, options }: { block: Block; options: RendererOptions }) {
  const data = (block.data ?? {}) as Record<string, any>;
  const items: string[] = Array.isArray(data.options) ? data.options : [];
  const [selected, setSelected] = React.useState<number | null>(null);
  const answered = selected !== null || options.completedBlocks?.[block.id];

  return (
    <Card className="p-4">
      <p className="text-sm font-medium">{data.question ?? 'Verificacion de lectura'}</p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            disabled={options.readOnly || Boolean(answered)}
            onClick={() => {
              setSelected(index);
              options.onBlockComplete?.(block.id);
            }}
            className={cn(
              'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
              selected === index ? 'border-primary bg-primary/10' : 'hover:bg-accent',
            )}
          >
            {item}
          </button>
        ))}
      </div>
      {answered ? (
        <p className="mt-3 text-xs text-emerald-600">Respuesta registrada. Puede continuar.</p>
      ) : null}
    </Card>
  );
}

function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      className="min-h-[120px] rounded-lg border p-4 text-left text-sm transition-colors hover:bg-accent"
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {flipped ? 'Respuesta' : 'Pregunta'}
      </p>
      <p className="mt-1 font-medium">{flipped ? back : front}</p>
      <p className="mt-3 text-xs text-muted-foreground">Toque para voltear</p>
    </button>
  );
}

/** Progress of the required blocks of a lesson. */
export function BlockProgress({
  document: blockDocument,
  completed,
}: {
  document: BlockDocument | null | undefined;
  completed: Record<string, boolean>;
}) {
  const required = (blockDocument?.blocks ?? []).filter((block) => block.required);
  if (!required.length) return null;
  const done = required.filter((block) => completed[block.id]).length;
  const value = Math.round((done / required.length) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Actividades obligatorias</span>
        <span>
          {done} de {required.length}
        </span>
      </div>
      <Progress value={value} tone={value === 100 ? 'success' : 'default'} />
    </div>
  );
}
