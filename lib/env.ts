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

function optional(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  return value;
}

function booleanFlag(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;

  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new Error(
    `Invalid boolean environment variable: ${name}. ` +
      `Use "true" or "false", not "${value}".`
  );
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  appUrl: required('NEXT_PUBLIC_APP_URL'),
  defaultOrgId: required('DEFAULT_ORG_ID'),
  /** Display name used in outgoing emails. Falls back to "AppName". */
  appName: process.env['NEXT_PUBLIC_APP_NAME'] ?? 'AppName',

  /** Microsoft / Graph configuration. Required by lib/microsoft/config.ts before Graph is used. */
  microsoftClientId: optional('MICROSOFT_CLIENT_ID'),
  microsoftClientSecret: optional('MICROSOFT_CLIENT_SECRET'),
  microsoftTenantId: process.env['MICROSOFT_TENANT_ID'] ?? 'common',
  microsoftRedirectUri: optional('MICROSOFT_REDIRECT_URI'),
  microsoftPostLogoutRedirectUri: optional('MICROSOFT_POST_LOGOUT_REDIRECT_URI'),
  microsoftGraphScopes:
    process.env['MICROSOFT_GRAPH_SCOPES'] ??
    'openid profile email offline_access User.Read Mail.Read',
  nextPublicMicrosoftClientId: optional('NEXT_PUBLIC_MICROSOFT_CLIENT_ID'),
  outlookAddInEnabled: booleanFlag('NEXT_PUBLIC_OUTLOOK_ADDIN_ENABLED', false),
} as const;
