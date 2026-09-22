import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Normalises every successful response to `{ data, meta }`.
 * Services that already return that shape are passed through untouched.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined || payload === null) return { data: null };
        if (typeof payload === 'object' && payload !== null && 'data' in payload) {
          return payload;
        }
        return { data: payload };
      }),
    );
  }
}
