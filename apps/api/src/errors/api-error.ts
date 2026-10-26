import { HttpException, Logger } from '@nestjs/common';
import {
  type ApiError,
  ERRORS,
  type ErrorCode,
  ErrorCodeSchema,
  type ValidationIssues,
} from '@erp/contracts';
import { ORPCError, ValidationError } from '@orpc/server';

const logger = new Logger('ApiError');

/** Throw from a handler or guard, e.g. `throw apiError('NOT_FOUND')`. */
export function apiError(code: ErrorCode, data?: unknown) {
  return new ORPCError(code, { status: ERRORS[code].status, data });
}

// Errors from oRPC itself (bad input, unknown route) and from Nest only carry an HTTP status.
const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT_RETRY',
};

/**
 * Turn anything thrown while handling a request into a catalogue error (ADR-0003).
 * Unknown failures become `INTERNAL_ERROR` and are logged here, never sent to the client.
 */
export function toApiError(error: unknown): ORPCError<ErrorCode, unknown> {
  if (error instanceof ORPCError && ErrorCodeSchema.safeParse(error.code).success) {
    return error as ORPCError<ErrorCode, unknown>;
  }

  const status =
    error instanceof ORPCError
      ? error.status
      : error instanceof HttpException
        ? error.getStatus()
        : 500;
  const code = CODE_BY_STATUS[status];
  if (code === 'VALIDATION_FAILED') return apiError(code, validationIssues(error));
  if (code) return apiError(code);

  logger.error(error instanceof ORPCError && error.cause ? error.cause : error);
  return apiError('INTERNAL_ERROR');
}

function validationIssues(error: unknown): ValidationIssues {
  const cause = error instanceof ORPCError ? error.cause : undefined;
  if (!(cause instanceof ValidationError)) return { issues: [] };
  return {
    issues: cause.issues.map((issue) => ({
      path: (issue.path ?? []).map((segment) => {
        const key = typeof segment === 'object' ? segment.key : segment;
        return typeof key === 'number' ? key : String(key);
      }),
      message: issue.message,
    })),
  };
}

/** The response body of every failed request: `{ code, kind, data? }`. */
export function encodeApiError(error: ORPCError<ErrorCode, unknown>): ApiError {
  return {
    code: error.code,
    kind: ERRORS[error.code].kind,
    ...(error.data === undefined ? {} : { data: error.data }),
  };
}
