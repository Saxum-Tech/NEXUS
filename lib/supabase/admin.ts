/**
 * lib/supabase/admin.ts
 * ─────────────────────────────────────────────────────────────
 * Supabase client authenticated with the SERVICE ROLE key.
 * This BYPASSES Row-Level Security entirely and can also call
 * the Auth Admin API (createUser, deleteUser, generateLink,
 * updateUserById, etc).
 *
 * ⚠️  RULES FOR USING THIS CLIENT — read before importing it:
 *
 *   1. NEVER import this file in anything that ships to the
 *      browser. It must only be referenced from Route Handlers,
 *      Server Actions, or scripts/ — i.e. code that only ever
 *      runs on the server. There is no "use client" guard that
 *      can save you here; if this key reaches the client bundle,
 *      every RLS policy in the database becomes irrelevant.
 *
 *   2. Every call site using this client MUST first check the
 *      calling user's permission via lib/auth/roles.ts (`can()`),
 *      and MUST write an audit_log row describing what it did
 *      and on whose behalf. See lib/auth/audit.ts.
 *
 *   3. SUPABASE_SERVICE_ROLE_KEY must never be prefixed with
 *      NEXT_PUBLIC_. Double-check your .env.local before adding
 *      any new secret here.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (_adminClient) return _adminClient;

  _adminClient = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}
