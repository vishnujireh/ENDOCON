/**
 * Application error with a stable machine-readable code. Anything that is not an AppError
 * is treated as an internal error and never leaks details to the client.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message: string, code = 'BAD_REQUEST', details?: unknown) => new AppError(400, code, message, details),
  validation: (details: unknown, message = 'Please correct the highlighted fields.') =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  unauthorized: (message = 'Please log in to continue.') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to perform this action.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string, code = 'CONFLICT', details?: unknown) => new AppError(409, code, message, details),
  tooMany: (message = 'Too many requests. Please try again later.') => new AppError(429, 'RATE_LIMITED', message),
  unavailable: (message: string, code = 'SERVICE_UNAVAILABLE') => new AppError(503, code, message),
};
