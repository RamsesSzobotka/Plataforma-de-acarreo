export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'BACKEND_ERROR'
  | 'BACKEND_UNAVAILABLE'
  | 'PAYMENT_METHOD_REQUIRED';

export class McpError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, httpStatus: number = 500, retryable: boolean = false) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: {
        httpStatus: this.httpStatus,
        retryable: this.retryable,
      },
    };
  }
}

export function httpErrorToMcpError(status: number, body?: { message?: string }): McpError {
  switch (status) {
    case 401:
      return new McpError('UNAUTHORIZED', body?.message ?? 'Token de autenticación inválido o expirado', status);
    case 403:
      return new McpError('FORBIDDEN', body?.message ?? 'No tienes permisos para esta acción', status);
    case 404:
      return new McpError('NOT_FOUND', body?.message ?? 'Recurso no encontrado', status);
    case 409:
      return new McpError('CONFLICT', body?.message ?? 'Conflicto: el estado actual no permite esta operación', status);
    case 400:
      return new McpError('INVALID_INPUT', body?.message ?? 'Datos de entrada inválidos', status);
    default:
      return new McpError('BACKEND_ERROR', body?.message ?? 'Error interno del backend', status);
  }
}
