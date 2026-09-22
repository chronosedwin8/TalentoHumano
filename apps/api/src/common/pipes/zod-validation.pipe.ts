import { Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_CODES } from '@talento/shared';
import type { ZodSchema } from 'zod';
import { BusinessException } from '../exceptions/business.exception';

/**
 * Validates a body/query with a Zod schema shared with the frontend.
 * Usage: `@Body(new ZodBody(employeeCreateSchema)) dto: EmployeeCreateInput`.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_FAILED,
        'Los datos enviados no son validos',
        422,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}

export const ZodBody = ZodValidationPipe;
