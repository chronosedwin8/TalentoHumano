import { BusinessException } from '../exceptions/business.exception';
import { paged, parsePage, parseSort, type Paged, type PageParams } from './pagination';

/** Any Prisma model delegate. */
export interface PrismaDelegate {
  findMany(args?: any): Promise<any>;
  findFirst(args?: any): Promise<any>;
  count(args?: any): Promise<any>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  updateMany(args: any): Promise<any>;
  delete?(args: any): Promise<any>;
  deleteMany?(args: any): Promise<any>;
}

export interface ListOptions {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  orderBy?: unknown;
  sortable?: string[];
  defaultSort?: Record<string, 'asc' | 'desc'>;
}

/** Paginated list against a tenant-scoped delegate. */
export async function listPaged<T = any>(
  delegate: PrismaDelegate,
  params: PageParams,
  options: ListOptions = {},
): Promise<Paged<T>> {
  const { page, limit, skip, take } = parsePage(params);
  const orderBy =
    options.orderBy ??
    parseSort(params.sort, options.sortable ?? [], options.defaultSort ?? { createdAt: 'desc' });

  const [rows, total] = (await Promise.all([
    delegate.findMany({
      where: options.where,
      ...(options.include ? { include: options.include } : {}),
      ...(options.select ? { select: options.select } : {}),
      orderBy,
      skip,
      take,
    }),
    delegate.count({ where: options.where }),
  ])) as [T[], number];

  return paged<T>(rows as T[], total, page, limit);
}

/** Finds a record or throws a 404 with a readable entity name. */
export async function findOrFail<T = any>(
  delegate: PrismaDelegate,
  where: Record<string, unknown>,
  entityName: string,
  include?: Record<string, unknown>,
): Promise<T> {
  const row = await delegate.findFirst({ where, ...(include ? { include } : {}) });
  if (!row) throw BusinessException.notFound(entityName);
  return row as T;
}

/** Marks a record as deleted instead of removing it. */
export async function softDelete(
  delegate: PrismaDelegate,
  id: string,
  userId?: string,
): Promise<{ id: string }> {
  await delegate.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), ...(userId ? { updatedById: userId } : {}) },
  });
  return { id };
}

/** `%value%` trigram search across several columns. */
export function searchWhere(search: string | undefined, fields: string[]): Record<string, unknown> {
  if (!search?.trim()) return {};
  const term = search.trim();
  return {
    OR: fields.map((field) =>
      field.includes('.')
        ? field
            .split('.')
            .reverse()
            .reduce<Record<string, unknown>>(
              (acc, key, index) =>
                index === 0 ? { [key]: { contains: term, mode: 'insensitive' } } : { [key]: acc },
              {},
            )
        : { [field]: { contains: term, mode: 'insensitive' } },
    ),
  };
}

/** Removes `undefined` keys so Prisma does not overwrite columns with null. */
export function defined<T extends Record<string, any>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>;
}
