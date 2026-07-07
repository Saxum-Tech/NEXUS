/**
 * lib/hooks/index.ts
 * ─────────────────────────────────────────────────────────────
 * Re-exports all client-side hooks from a single entry point.
 *
 *   import { useApiQuery, useApiMutation } from '@/lib/hooks';
 * ─────────────────────────────────────────────────────────────
 */

export { useApiQuery } from './useApiQuery';
export type { ApiQueryState } from './useApiQuery';

export { useApiMutation } from './useApiMutation';
export type { ApiMutationState, MutationOptions } from './useApiMutation';
