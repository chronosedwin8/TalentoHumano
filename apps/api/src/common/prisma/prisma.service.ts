import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ERROR_CODES } from '@talento/shared';

/** Refuses a write that would reach a row belonging to another company. */
class TenantMismatchError extends HttpException {
  constructor(model: string) {
    super(
      {
        code: ERROR_CODES.TENANT_MISMATCH,
        message: 'El registro pertenece a otra empresa',
        details: { model },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/** Prisma model names (delegate keys) that carry a `companyId` column. */
const MODELS_WITH_COMPANY = new Set<string>(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'companyId'))
    .map((m) => m.name),
);

/** Models whose `companyId` is nullable (platform-wide rows are allowed). */
const MODELS_WITH_OPTIONAL_COMPANY = new Set<string>(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'companyId' && !f.isRequired))
    .map((m) => m.name),
);

const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_WITH_WHERE = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

/**
 * Builds a client scoped to one tenant: `where.companyId` is injected on reads
 * and writes, and `data.companyId` on creates.
 */
function buildTenantClient(base: PrismaClient, companyId: string) {
  return base.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !MODELS_WITH_COMPANY.has(model)) {
            return query(args as never);
          }

          const a = (args ?? {}) as Record<string, any>;
          const optional = MODELS_WITH_OPTIONAL_COMPANY.has(model);
          // Platform-wide catalogue rows (companyId = null) stay visible.
          const companyFilter = optional
            ? { OR: [{ companyId }, { companyId: null }] }
            : { companyId };

          if (READ_OPERATIONS.has(operation) || WRITE_WITH_WHERE.has(operation)) {
            const where = (a.where ?? {}) as Record<string, any>;
            const previous = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
            a.where = { ...where, AND: [...previous, companyFilter] };
            return query(a as never);
          }

          if (operation === 'create') {
            a.data = { companyId, ...(a.data ?? {}) };
            return query(a as never);
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = a.data;
            a.data = Array.isArray(data)
              ? data.map((row: Record<string, unknown>) => ({ companyId, ...row }))
              : { companyId, ...(data ?? {}) };
            return query(a as never);
          }

          if (operation === 'upsert') {
            a.create = { companyId, ...(a.create ?? {}) };

            /**
             * `upsert` has the same blind spot as `findUnique`: its `where`
             * only accepts unique fields, so the tenant filter cannot be
             * added to it. Left alone, a unique key that happens to match a
             * row of another company would update that row.
             *
             * So the row is resolved first with the tenant filter applied. If
             * it exists in this company, it is updated by id; if it exists in
             * another one, the write is refused instead of silently crossing
             * the boundary; if it does not exist, the create runs as usual.
             */
            const existing = (await (base as never as Record<string, any>)[
              model.charAt(0).toLowerCase() + model.slice(1)
            ].findFirst({
              where: a.where,
              select: { id: true, companyId: true },
            })) as { id: string; companyId: string | null } | null;

            if (existing && existing.companyId !== companyId && existing.companyId !== null) {
              throw new TenantMismatchError(model);
            }
            if (existing) {
              a.where = { id: existing.id };
            }
            return query(a as never);
          }

          return query(a as never);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof buildTenantClient>;

/**
 * `companyId` is injected at runtime on create/upsert, so the create payloads
 * are typed loosely; reads, includes and selects keep their full typing.
 */
type LooseCreates<D> = Omit<D, 'create' | 'createMany' | 'createManyAndReturn' | 'upsert'> & {
  create(args: any): Promise<any>;
  createMany(args: any): Promise<{ count: number }>;
  createManyAndReturn?(args: any): Promise<any>;
  upsert(args: any): Promise<any>;
};

export type TenantClient = {
  [K in keyof ExtendedClient]: ExtendedClient[K] extends { findMany: (args?: any) => any }
    ? LooseCreates<ExtendedClient[K]>
    : ExtendedClient[K];
};

/**
 * Prisma wrapper.
 *
 * `forCompany(companyId)` returns a tenant-scoped client. Because `findUnique`
 * cannot receive extra filters, the extension leaves it untouched: services
 * must use `findFirst` for tenant-owned records. See docs/DECISIONS.md
 * (ADR-0002).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantClients = new Map<string, TenantClient>();

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cached tenant-scoped client. */
  forCompany(companyId: string): TenantClient {
    const cached = this.tenantClients.get(companyId);
    if (cached) return cached;
    const client = buildTenantClient(this, companyId) as unknown as TenantClient;
    // Bounded cache; tenants are few and long lived.
    if (this.tenantClients.size > 200) this.tenantClients.clear();
    this.tenantClients.set(companyId, client);
    return client;
  }

  /** Truncates every table. Only used by the e2e test harness. */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('truncateAll is not allowed in production');
    }
    const tables = Prisma.dmmf.datamodel.models.map((m) => `"${m.dbName ?? m.name}"`);
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`);
  }
}
