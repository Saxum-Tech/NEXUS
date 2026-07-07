/**
 * lib/supabase/server.ts
 * ─────────────────────────────────────────────────────────────
 * Supabase client for use inside Server Components, Route
 * Handlers, and Server Actions. This client is bound to the
 * incoming request's cookies, so it runs AS THE LOGGED-IN USER —
 * every query goes through RLS exactly as if it came from the
 * browser. Use this for all normal reads/writes.
 *
 * For privileged operations that must bypass RLS (creating a
 * user, suspending an account, etc.), use lib/supabase/admin.ts
 * instead, and ALWAYS pair it with an explicit permission check
 * from lib/auth/roles.ts plus an audit log write.
 * ─────────────────────────────────────────────────────────────
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // Called from a Server Component render — cookies can't be
            // set here. Safe to ignore as long as middleware.ts is also
            // refreshing the session (it is — see middleware.ts).
          }
        },
      },
    }
  );
}
