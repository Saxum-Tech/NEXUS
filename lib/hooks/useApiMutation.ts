/**
 * lib/hooks/useApiMutation.ts
 * ─────────────────────────────────────────────────────────────
 * Companion to useApiQuery for state-changing operations
 * (POST, PATCH, DELETE). Returns a `mutate` function and
 * tracks loading/error state so call sites don't have to.
 *
 * Usage:
 *   const { mutate, isLoading, error } = useApiMutation(
 *     `/api/admin/users/${userId}/suspend`,
 *     'POST',
 *     { onSuccess: () => { showToast('Suspended'); refetch(); } }
 *   );
 *
 *   <Button loading={isLoading} onClick={() => mutate()}>Suspend</Button>
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, useCallback } from 'react';

export interface MutationOptions<TResponse> {
  onSuccess?: (data: TResponse) => void;
  onError?: (error: string) => void;
}

export interface ApiMutationState<TBody, TResponse> {
  mutate: (body?: TBody) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  /** Clears the error state without running the mutation. */
  clearError: () => void;
}

export function useApiMutation<TBody = void, TResponse = { ok: boolean }>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  options: MutationOptions<TResponse> = {}
): ApiMutationState<TBody, TResponse> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: TBody) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(url, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        const data = await res.json();

        if (!res.ok) {
          const message = data.error ?? `Request failed (${res.status})`;
          setError(message);
          options.onError?.(message);
          return;
        }

        options.onSuccess?.(data as TResponse);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not reach the server.';
        setError(message);
        options.onError?.(message);
      } finally {
        setIsLoading(false);
      }
    },
    [url, method, options]
  );

  const clearError = useCallback(() => setError(null), []);

  return { mutate, isLoading, error, clearError };
}
