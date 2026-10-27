import { ErrorCodeSchema } from '@erp/contracts';
import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

const thai = /[฀-๿]/;

describe('Thai error messages', () => {
  it.each(ErrorCodeSchema.options)('has a Thai message for %s', (code) => {
    expect(errorMessage({ code, kind: 'correct' })).toMatch(thai);
  });
});
