import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@talento/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const body = this.toErrorBody(exception, request);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.code}: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} -> ${body.statusCode} ${body.code}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, request: Request): ErrorBody {
    const base = { timestamp: new Date().toISOString(), path: request.url };

    if (exception instanceof ZodError) {
      return {
        ...base,
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Los datos enviados no son validos',
        details: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        return {
          ...base,
          statusCode: status,
          code: (p.code as string) ?? this.codeForStatus(status),
          message: Array.isArray(p.message)
            ? (p.message as string[]).join('; ')
            : ((p.message as string) ?? exception.message),
          details: p.details ?? (Array.isArray(p.message) ? p.message : undefined),
        };
      }
      return {
        ...base,
        statusCode: status,
        code: this.codeForStatus(status),
        message: String(payload),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...base, ...this.fromPrisma(exception) };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Consulta invalida contra la base de datos',
      };
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrio un error inesperado. Intente nuevamente.',
    };
  }

  private fromPrisma(
    error: Prisma.PrismaClientKnownRequestError,
  ): Pick<ErrorBody, 'statusCode' | 'code' | 'message' | 'details'> {
    const target = (error.meta?.target as string[] | string | undefined) ?? undefined;
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ERROR_CODES.CONFLICT,
          message: 'Ya existe un registro con esos datos unicos',
          details: { fields: target },
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ERROR_CODES.CONFLICT,
          message: 'El registro esta referenciado por otros datos',
          details: { field: error.meta?.field_name },
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ERROR_CODES.NOT_FOUND,
          message: 'El registro solicitado no existe',
        };
      default:
        if (error.message.includes('leave_requests_no_overlap')) {
          return {
            statusCode: HttpStatus.CONFLICT,
            code: ERROR_CODES.LEAVE_OVERLAP,
            message: 'La ausencia se cruza con otra ya aprobada del mismo colaborador',
          };
        }
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: `DB_${error.code}`,
          message: 'La operacion no pudo completarse en la base de datos',
        };
    }
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.VALIDATION_FAILED;
      default:
        return 'HTTP_ERROR';
    }
  }
}
