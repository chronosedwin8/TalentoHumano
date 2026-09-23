import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PublicCompany {
  id?: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  website?: string | null;
  privacyPolicy?: string | null;
}

/**
 * Chrome shared by every portal that runs without a session. It applies the
 * company's brand color as a CSS variable so the page looks like theirs.
 */
export function PublicShell({
  company,
  title,
  subtitle,
  children,
  className,
}: {
  company?: PublicCompany | null;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const style = company?.primaryColor
    ? ({ ['--brand' as string]: company.primaryColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-muted/30" style={style}>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          {company?.logoUrl ? (
            <img src={company.logoUrl} alt={company.name} className="h-9 w-auto object-contain" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
              style={{ backgroundColor: company?.primaryColor ?? '#2a78d6' }}
              aria-hidden
            >
              {(company?.name ?? 'T').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{company?.name ?? 'TALENTO'}</p>
            {title ? <p className="truncate text-xs text-muted-foreground">{title}</p> : null}
          </div>
          {company?.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Sitio web
            </a>
          ) : null}
        </div>
      </header>

      <main className={cn('mx-auto max-w-5xl px-4 py-8', className)}>
        {title ? (
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>

      <footer className="border-t bg-background py-6">
        <div className="mx-auto max-w-5xl px-4 text-xs text-muted-foreground">
          <p>
            {company?.name ?? 'TALENTO'} trata sus datos personales conforme a la Ley 1581 de 2012.
            Puede solicitar su consulta, actualizacion o supresion en cualquier momento.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Small brand-colored button used by the public portals. */
export function BrandButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      style={{ backgroundColor: 'var(--brand, #2a78d6)', ...props.style }}
    />
  );
}
