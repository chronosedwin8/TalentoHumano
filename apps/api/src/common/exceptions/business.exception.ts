import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@talento/shared';

/**
 * Business error with a stable machine readable code.
 * The global filter turns it into `{ statusCode, code, message, details }`.
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(entity = 'Registro', details?: unknown) {
    return new BusinessException(
      ERROR_CODES.NOT_FOUND,
      `${entity} no encontrado`,
      HttpStatus.NOT_FOUND,
      details,
    );
  }

  static forbidden(message = 'No tiene permiso para realizar esta accion', details?: unknown) {
    return new BusinessException(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN, details);
  }

  static permissionDenied(permission: string) {
    return new BusinessException(
      ERROR_CODES.PERMISSION_DENIED,
      'No tiene el permiso requerido para esta operacion',
      HttpStatus.FORBIDDEN,
      { permission },
    );
  }

  static outOfScope(details?: unknown) {
    return new BusinessException(
      ERROR_CODES.OUT_OF_SCOPE,
      'El registro esta fuera de su alcance de datos',
      HttpStatus.FORBIDDEN,
      details,
    );
  }

  static conflict(
    message: string,
    code: ErrorCode | string = ERROR_CODES.CONFLICT,
    details?: unknown,
  ) {
    return new BusinessException(code, message, HttpStatus.CONFLICT, details);
  }

  static validation(message: string, details?: unknown) {
    return new BusinessException(
      ERROR_CODES.VALIDATION_FAILED,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }

  static unauthorized(
    code: ErrorCode | string = ERROR_CODES.UNAUTHENTICATED,
    message = 'Sesion invalida',
  ) {
    return new BusinessException(code, message, HttpStatus.UNAUTHORIZED);
  }
}
