import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { clearSession, isUnauthorized } from '@/lib/auth';

export function createQueryClient() {
  // UNAUTHENTICATED or USER_INACTIVE (e.g. the session expired) signs the user out, which sends them to /login.
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) clearSession(queryClient);
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return queryClient;
}
