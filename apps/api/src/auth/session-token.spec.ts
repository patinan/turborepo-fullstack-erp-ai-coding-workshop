import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  readCookie,
  SESSION_TTL_MS,
  verifySessionToken,
} from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';

describe('session token', () => {
  it('round-trips the user id and issue time', () => {
    const issuedAt = Date.now();
    const token = createSessionToken('user-1', secret, issuedAt);

    expect(verifySessionToken(token, secret)).toEqual({
      userId: 'user-1',
      issuedAt: new Date(issuedAt),
    });
  });

  it('accepts a token just under 12 hours old', () => {
    const issuedAt = Date.now() - 12 * 60 * 60 * 1000 + 1000;

    expect(verifySessionToken(createSessionToken('user-1', secret, issuedAt), secret)).not.toBeNull();
  });

  it('rejects a token whose user id was changed', () => {
    const [, issuedAt, signature] = createSessionToken('user-1', secret).split('.');

    expect(verifySessionToken(`user-2.${issuedAt}.${signature}`, secret)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const token = createSessionToken('user-1', 'another-secret-that-is-at-least-32-chars');

    expect(verifySessionToken(token, secret)).toBeNull();
  });

  it('rejects an expired token', () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1;
    const token = createSessionToken('user-1', secret, issuedAt);

    expect(verifySessionToken(token, secret)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySessionToken('nope', secret)).toBeNull();
  });
});

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; erp_session=abc.def; b=2', 'erp_session')).toBe('abc.def');
  });

  it('returns undefined when the header or cookie is missing', () => {
    expect(readCookie(undefined, 'erp_session')).toBeUndefined();
    expect(readCookie('a=1', 'erp_session')).toBeUndefined();
  });
});
