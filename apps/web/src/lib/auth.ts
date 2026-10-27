import type { User } from '@erp/contracts';
import { ORPCError } from '@orpc/client';
import { hashKey, type QueryClient, useQuery } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc';

/** The session from GET /api/auth/me. It only changes on login, logout or a signed-out error, so it never goes stale. */
export function useSession() {
  return useQuery(orpc.auth.me.queryOptions({ staleTime: Infinity }));
}

/** The signed-in user. Always set inside routes wrapped by `RequireAuth`. */
export function useCurrentUser(): User | null {
  return useSession().data?.user ?? null;
}

/** The session is missing, expired, signed out or its user was deactivated. */
export function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof ORPCError &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'USER_INACTIVE')
  );
}

/** Forget the user and all their cached data. `RequireAuth` then redirects to /login. */
export function clearSession(queryClient: QueryClient) {
  const sessionKey = orpc.auth.me.queryKey();
  queryClient.removeQueries({ predicate: (query) => query.queryHash !== hashKey(sessionKey) });
  queryClient.setQueryData(sessionKey, { user: null });
}

/** Only follow same-origin paths from `?redirect=`, never another site. */
export function safeRedirect(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
