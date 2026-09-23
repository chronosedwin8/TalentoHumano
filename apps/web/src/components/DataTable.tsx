import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import * as React from 'react';
import { Button, EmptyState, Input, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** Renders the cell; defaults to the raw value of `key`. */
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hidden on small screens. */
  hideOnMobile?: boolean;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  loading?: boolean;
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  sort?: string;
  onSortChange?: (sort: string) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading = false,
  total = 0,
  page = 1,
  limit = 25,
  onPageChange,
  onRowClick,
  rowKey,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'Ajuste los filtros o cree el primer registro.',
  emptyAction,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  toolbar,
  sort,
  onSortChange,
  className,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const showToolbar = Boolean(onSearchChange || toolbar);

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (sort === key) onSortChange(`-${key}`);
    else if (sort === `-${key}`) onSortChange('');
    else onSortChange(key);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {showToolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ''}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label="Buscar"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                      column.hideOnMobile && 'hidden md:table-cell',
                      column.sortable &&
                        onSortChange &&
                        'cursor-pointer select-none hover:text-foreground',
                      column.headerClassName,
                    )}
                    onClick={column.sortable ? () => toggleSort(column.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.header}
                      {sort === column.key ? '↑' : sort === `-${column.key}` ? '↓' : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn('px-4 py-3', column.hideOnMobile && 'hidden md:table-cell')}
                      >
                        <Skeleton className="h-4 w-full max-w-[160px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      icon={Inbox}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={rowKey ? rowKey(row) : (row.id ?? index)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-muted/50',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-3 align-middle',
                          column.hideOnMobile && 'hidden md:table-cell',
                          column.className,
                        )}
                      >
                        {column.render ? column.render(row) : (row[column.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {onPageChange && total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {total} registro{total === 1 ? '' : 's'} · pagina {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
