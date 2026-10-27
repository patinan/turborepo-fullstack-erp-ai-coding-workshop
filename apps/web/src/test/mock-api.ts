import { ERRORS, type ErrorCode } from '@erp/contracts';
import { vi } from 'vitest';

/**
 * Stub `fetch` with one response per route, keyed by `'<METHOD> <path without /api>'`.
 * Values are JSON bodies (status 200), or a `Response` for anything else (see `unauthorized()`).
 * Unmocked routes answer 404. Undo with `vi.unstubAllGlobals()`.
 */
export function mockApi(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (request: Request) => {
    const key = `${request.method} ${new URL(request.url).pathname.replace(/^\/api/, '')}`;
    if (!(key in routes)) return Response.json({ message: `No mock for ${key}` }, { status: 404 });

    const value = routes[key];
    return value instanceof Response ? value.clone() : Response.json(value);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** A failed call as the API sends it: `{ code, kind, data? }` with the catalogue status. */
export function apiError(code: ErrorCode, data?: unknown) {
  const { kind, status } = ERRORS[code];
  return Response.json({ code, kind, data }, { status });
}

/** The 401 the API sends for a missing, expired or signed-out session. */
export function unauthorized() {
  return apiError('UNAUTHENTICATED');
}
