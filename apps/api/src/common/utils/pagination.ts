import { PAGINATION, type ApiMeta } from '@talento/shared';

export interface PageParams {
  page?: number | string;
  limit?: number | string;
  sort?: string;
  search?: string;
}

export interface Paged<T> {
  data: T[];
  meta: ApiMeta;
}

export function parsePage(params: PageParams): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Number(params.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Number(params.limit) || PAGINATION.DEFAULT_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * Turns `?sort=-hired_at,last_name` into a Prisma orderBy array.
 * Only fields present in `allowed` are honoured, so the parameter can never
 * reach the database unchecked.
 */
export function parseSort(
  sort: string | undefined,
  allowed: string[],
  fallback: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
): Array<Record<string, 'asc' | 'desc'>> {
  if (!sort) return [fallback];
  const parts = sort
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const desc = raw.startsWith('-');
      const field = desc ? raw.slice(1) : raw;
      return allowed.includes(field) ? { [field]: desc ? 'desc' : 'asc' } : null;
    })
    .filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
  return parts.length ? parts : [fallback];
}

export function paged<T>(rows: T[], total: number, page: number, limit: number): Paged<T> {
  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Extracts `?filter[key]=value` pairs from an Express query object. */
export function parseFilters(query: Record<string, unknown>): Record<string, string> {
  const filter = query.filter;
  if (filter && typeof filter === 'object') {
    return Object.fromEntries(
      Object.entries(filter as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
  }
  return {};
}
