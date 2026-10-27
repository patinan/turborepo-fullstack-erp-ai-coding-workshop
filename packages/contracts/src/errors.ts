import * as z from 'zod';

/** `correct`: the user must change their input. `retry`: the same request may work later. */
export const ErrorKindSchema = z.enum(['correct', 'retry']);
export type ErrorKind = z.infer<typeof ErrorKindSchema>;

/**
 * Every code the API can return (ADR-0003). The web holds a Thai message for each one.
 * Add a code here, with its kind and HTTP status, before throwing it from the API.
 */
export const ErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'USER_INACTIVE',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT_RETRY',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERRORS: Record<ErrorCode, { kind: ErrorKind; status: number }> = {
  VALIDATION_FAILED: { kind: 'correct', status: 400 },
  UNAUTHENTICATED: { kind: 'correct', status: 401 },
  INVALID_CREDENTIALS: { kind: 'correct', status: 401 },
  USER_INACTIVE: { kind: 'correct', status: 403 },
  FORBIDDEN: { kind: 'correct', status: 403 },
  NOT_FOUND: { kind: 'correct', status: 404 },
  CONFLICT_RETRY: { kind: 'retry', status: 409 },
  INTERNAL_ERROR: { kind: 'retry', status: 500 },
};

/** The body of every failed API response. */
export const ApiErrorSchema = z
  .object({
    code: ErrorCodeSchema,
    kind: ErrorKindSchema,
    data: z.unknown().optional(),
  })
  .refine((error) => ERRORS[error.code].kind === error.kind, {
    message: 'kind does not match the code',
    path: ['kind'],
  });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** `data` of `VALIDATION_FAILED`: which fields were wrong. */
export const ValidationIssuesSchema = z.object({
  issues: z.array(
    z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }),
  ),
});
export type ValidationIssues = z.infer<typeof ValidationIssuesSchema>;
