/**
 * lib/hooks/useApiQuery.ts
 * ─────────────────────────────────────────────────────────────
 * Standardised client-side data fetching hook. Replaces the
 * repeated useEffect + fetch + loading + error state pattern
 * that every client page currently implements independently.
 *
 * Features:
 *   - Automatic fetch on mount (and on `params` change)
 *   - Consistent { data, isLoading, error, refetch } shape
 *   - Debounced re-fetching when params change (avoids firing
 *     a request on every keystroke in a search field)
 *   - Request deduplication: if `params` hasn't changed, a
 *     second call to `refetch()` within the debounce window
 *     is a no-op
 *   - Abort controller: in-flight requests from a previous
 *     render are cancelled when params change
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useApiQuery<UsersResponse>(
 *     '/api/admin/users',
 *     { search, page }            // re-fetches when these change
 *   );
 *
 * For mutations (POST/PATCH/DELETE) use the companion
 * useApiMutation hook (lib/hooks/useApiMutation.ts).
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiQueryState<T> {
  data: T | null;
  isLoading: boolean;
  /** The error message from the API, or a network error string. */
  error: string | null;
  refetch: () => void;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Serialises params to a stable string for change-detection.
 * Sorts keys so { a:1, b:2 } and { b:2, a:1 } are equal.
 */
function stableSerialise(params: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .sort(([a], [b]) => a.localeCompare(b))
    )
  );
}

export function useApiQuery<T>(
  url: string,
  params: Record<string, unknown> = {},
  options: { debounceMs?: number; enabled?: boolean } = {}
): ApiQueryState<T> {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Track the serialised params so we can detect real changes.
  const paramsKeyRef = useRef<string>('');
  // Debounce timer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Abort controller for the in-flight request.
  const abortRef = useRef<AbortController | null>(null);
  // Stable refetch trigger (incrementing forces a re-run).
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const newKey = stableSerialise(params);

    // Clear any pending debounce timer.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      // Abort the previous in-flight request if params changed.
      if (abortRef.current && paramsKeyRef.current !== newKey) {
        abortRef.current.abort();
      }

      paramsKeyRef.current = newKey;
      abortRef.current = new AbortController();

      // Build the URL with query string.
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          query.set(key, String(value));
        }
      }
      const fullUrl = query.toString() ? `${url}?${query}` : url;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(fullUrl, { signal: abortRef.current.signal });
        const json = await res.json();

        if (!res.ok) {
          setError(json.error ?? `Request failed (${res.status})`);
          return;
        }

        setData(json);
      } catch (err) {
        // Don't surface AbortError — it's intentional.
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Could not reach the server. Check your connection.');
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, stableSerialise(params), enabled, tick]);

  // Cancel the in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { data, isLoading, error, refetch };
}
