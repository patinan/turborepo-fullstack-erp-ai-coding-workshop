import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, ERRORS, ErrorCodeSchema } from './errors.js';

describe('error catalogue', () => {
  it('includes the identity and generic codes', () => {
    expect(ErrorCodeSchema.options).toEqual(
      expect.arrayContaining([
        'VALIDATION_FAILED',
        'UNAUTHENTICATED',
        'INVALID_CREDENTIALS',
        'USER_INACTIVE',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT_RETRY',
        'INTERNAL_ERROR',
      ]),
    );
  });

  it('asks the user to retry only on a conflict or an unexpected failure', () => {
    const retry = ErrorCodeSchema.options.filter((code) => ERRORS[code].kind === 'retry');

    expect(retry).toEqual(['CONFLICT_RETRY', 'INTERNAL_ERROR']);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts a code with its kind', () => {
    const error = { code: 'INVALID_CREDENTIALS', kind: 'correct' };

    expect(ApiErrorSchema.safeParse(error).data).toEqual(error);
  });

  it('accepts data for the message', () => {
    const error = {
      code: 'VALIDATION_FAILED',
      kind: 'correct',
      data: { issues: [{ path: ['username'], message: 'Too small' }] },
    };

    expect(ApiErrorSchema.safeParse(error).data).toEqual(error);
  });

  it('rejects an unknown code', () => {
    expect(ApiErrorSchema.safeParse({ code: 'UNAUTHORIZED', kind: 'correct' }).success).toBe(false);
  });

  it('rejects an error without a kind', () => {
    expect(ApiErrorSchema.safeParse({ code: 'NOT_FOUND' }).success).toBe(false);
  });

  it('rejects a kind that is not the code’s kind', () => {
    expect(ApiErrorSchema.safeParse({ code: 'INTERNAL_ERROR', kind: 'correct' }).success).toBe(
      false,
    );
  });
});
