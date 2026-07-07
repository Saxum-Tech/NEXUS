/**
 * lib/env.ts
 * ─────────────────────────────────────────────────────────────
 * Centralised, validated access to required environment
 * variables. Import `env` instead of scattering
 * `process.env.FOO!` across every file — this way a missing
 * variable throws a clear, named error at startup rather than a
 * cryptic runtime crash deep inside business logic.
 *
 * Server-only: never import this from client components.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Check your .env.local against .env.example.`
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  appUrl: required('NEXT_PUBLIC_APP_URL'),
  defaultOrgId: required('DEFAULT_ORG_ID'),
  /** Display name used in outgoing emails. Falls back to "AppName". */
  appName: process.env['NEXT_PUBLIC_APP_NAME'] ?? 'AppName',
} as const;
