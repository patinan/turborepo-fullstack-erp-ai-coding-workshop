import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  readCookie,
  SESSION_TTL_MS,
  verifySessionToken,
} from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const now = Date.UTC(2026, 9, 27, 9, 0, 0);

describe('session token', () => {
  it('round-trips the user id and issue time', () => {
    const issuedAt = now;
    const token = createSessionToken('user-1', secret, issuedAt);

    expect(verifySessionToken(token, secret, now)).toEqual({
      userId: 'user-1',
      issuedAt: new Date(issuedAt),
    });
  });

  it('accepts a token just under 12 hours old', () => {
    const issuedAt = now - 12 * 60 * 60 * 1000 + 1000;

    expect(
      verifySessionToken(createSessionToken('user-1', secret, issuedAt), secret, now),
    ).not.toBeNull();
  });

  it('rejects a token whose user id was changed', () => {
    const [, issuedAt, signature] = createSessionToken('user-1', secret, now).split('.');

    expect(verifySessionToken(`user-2.${issuedAt}.${signature}`, secret, now)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const token = createSessionToken('user-1', 'another-secret-that-is-at-least-32-chars', now);

    expect(verifySessionToken(token, secret, now)).toBeNull();
  });

  it('rejects an expired token', () => {
    const issuedAt = now - SESSION_TTL_MS - 1;
    const token = createSessionToken('user-1', secret, issuedAt);

    expect(verifySessionToken(token, secret, now)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySessionToken('nope', secret, now)).toBeNull();
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
