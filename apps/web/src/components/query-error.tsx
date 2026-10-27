import { Button } from '@/components/ui/button';
import { errorMessage, toApiError } from '@/lib/errors';

/** A failed read in Thai, with a retry button when the error says retrying may help (ADR-0003). */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = toApiError(error);
  return (
    <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>{errorMessage(apiError)}</p>
      {apiError.kind === 'retry' && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}
