/**
 * lib/config/get-app-config.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches the current org's branding/config row for use in
 * Server Components (e.g. the root layout, which needs the app
 * name for <title> and the primary colour for an inline style
 * tag, before any client JS runs — avoiding a flash of default
 * branding).
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

export type AppConfig = Database['public']['Tables']['app_config']['Row'];

const FALLBACK_CONFIG: Omit<AppConfig, 'org_id' | 'updated_by' | 'updated_at'> = {
  app_name: 'AppName',
  support_email: null,
  default_language: 'en',
  timezone: 'UTC',
  logo_url: null,
  favicon_url: null,
  primary_color: '#6c4de6',
  icon_letter: 'A',
  allow_public_registration: false,
  require_password_change_on_first_login: true,
  session_timeout_minutes: 30,
  enforce_password_complexity: true,
  limit_concurrent_sessions: false,
};

/**
 * Reads app_config for the given org. Uses the admin client
 * (not the per-request RLS client) because this is called from
 * the root layout BEFORE we necessarily know if there's a valid
 * session — app_config must render even on the logged-out
 * /login page. The RLS policy on app_config would allow this
 * anyway for any authenticated org member, but logged-out
 * requests need it too, hence the admin client here specifically.
 */
export async function getAppConfig(orgId: string): Promise<AppConfig> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('app_config')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    logger.error('[getAppConfig] falling back to defaults', { err: String(error) });
    return { org_id: orgId, updated_by: null, updated_at: new Date().toISOString(), ...FALLBACK_CONFIG };
  }

  return data;
}
