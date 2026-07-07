/**
 * lib/auth/audit.ts
 * ─────────────────────────────────────────────────────────────
 * Single entry point for writing to public.audit_log. Always
 * uses the admin client (audit writes are not exposed to the
 * authenticated client role — see migration 0002).
 *
 * Call this from every Route Handler that performs a privileged
 * mutation (invite, suspend, role change, config edit, password
 * reset, login attempt). Fire-and-forget is fine for non-critical
 * paths, but the await is cheap and keeps ordering predictable
 * in server logs — prefer awaiting it.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/lib/auth/roles';

export interface AuditEventInput {
  orgId: string;
  actorId: string | null;
  actorUsername: string | null;
  actorRole: AppRole | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Common, well-known action strings. Using these constants
 * instead of free-text keeps the audit log filterable and
 * gives autocomplete at call sites. Add new ones here as the
 * app grows rather than inlining ad-hoc strings.
 */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.failed',
  AUTH_LOGOUT: 'auth.logout',
  USER_INVITE: 'user.invite',
  USER_INVITE_RESEND: 'user.invite_resend',
  USER_PASSWORD_SET: 'user.password_set',
  USER_PASSWORD_RESET_BY_ADMIN: 'user.password_reset_admin',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_SUSPEND: 'user.suspend',
  USER_REINSTATE: 'user.reinstate',
  USER_DELETE: 'user.delete',
  CONFIG_UPDATE: 'config.update',
} as const;

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from('audit_log').insert({
    org_id: event.orgId,
    actor_id: event.actorId,
    actor_username: event.actorUsername,
    actor_role: event.actorRole,
    action: event.action,
    target_type: event.targetType ?? null,
    target_id: event.targetId ?? null,
    metadata: event.metadata ?? {},
    ip_address: event.ipAddress ?? null,
    user_agent: event.userAgent ?? null,
  });

  if (error) {
    // Audit logging must never crash the primary operation it's
    // describing (e.g. a successful invite shouldn't 500 just
    // because the audit insert failed). Log loudly to server
    // logs/monitoring instead.
    logger.error('[audit] failed to write audit event', {
      action: event.action,
      orgId: event.orgId,
      err: String(error),
    });
  }
}

/** Pulls IP + user-agent off a Next.js Request in one place. */
export function extractRequestContext(request: Request) {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}
