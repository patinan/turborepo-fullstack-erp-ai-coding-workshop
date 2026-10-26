import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'erp_session';
/** A sign-in lasts at most 12 hours [C-16]. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** `<userId>.<issuedAt ms>.<HMAC>`: readable, but can't be changed without the secret. */
export function createSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload = `${userId}.${now}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The session when the token is authentic and not expired, otherwise null. */
export function verifySessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; issuedAt: Date } | null {
  const [userId, issuedAt, signature] = token.split('.');
  if (!userId || !issuedAt || !signature) return null;

  const expected = Buffer.from(sign(`${userId}.${issuedAt}`, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const issued = Number(issuedAt);
  return issued + SESSION_TTL_MS > now ? { userId, issuedAt: new Date(issued) } : null;
}

/** Read one cookie from a raw `Cookie` header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}
