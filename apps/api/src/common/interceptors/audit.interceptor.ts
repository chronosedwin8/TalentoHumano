import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuditAction } from '@prisma/client';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, SENSITIVE_KEY, type AuditMetadata } from '../decorators';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestContext } from '../types/request-context';

const METHOD_ACTION: Record<string, AuditAction> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
  GET: 'read',
};

/**
 * Writes an `audit_logs` row for every annotated write endpoint.
 * Services that need a before/after diff call `AuditService.record` directly;
 * this interceptor covers the "who did what, when and from where" baseline.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditMetadata | undefined>(AUDIT_KEY, context.getHandler());
    const sensitiveEntity = this.reflector.get<string | undefined>(
      SENSITIVE_KEY,
      context.getHandler(),
    );
    if (!metadata && !sensitiveEntity) return next.handle();

    const request = context.switchToHttp().getRequest();
    const ctx: RequestContext | undefined = request.ctx;

    return next.handle().pipe(
      tap((payload) => {
        if (!ctx) return;

        if (sensitiveEntity) {
          const permissions = this.reflector.get<string[]>(
            'talento:permissions',
            context.getHandler(),
          );
          void this.audit.recordSensitiveAccess(
            ctx,
            permissions?.[0] ?? 'sensitive.read',
            sensitiveEntity,
            request.params?.id ?? null,
          );
        }

        if (!metadata) return;

        const entityId =
          (metadata.idParam ? request.params?.[metadata.idParam] : undefined) ??
          request.params?.id ??
          this.idFromPayload(payload);

        void this.audit.record(ctx, {
          action: metadata.action ?? METHOD_ACTION[request.method] ?? 'update',
          entityType: metadata.entityType,
          entityId: entityId ?? null,
          summary: metadata.summary ?? `${request.method} ${request.route?.path ?? request.url}`,
        });
      }),
    );
  }

  private idFromPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = 'data' in payload ? (payload as { data: unknown }).data : payload;
    if (data && typeof data === 'object' && 'id' in data) {
      const id = (data as { id: unknown }).id;
      return typeof id === 'string' ? id : null;
    }
    return null;
  }
}
