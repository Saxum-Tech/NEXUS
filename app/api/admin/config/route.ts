/**
 * app/api/admin/config/route.ts
 * ─────────────────────────────────────────────────────────────
 * Reads and updates the org's dynamic branding/config row.
 * GET is intentionally available to ANY authenticated user (not
 * just admins) because the frontend needs app_name/logo/colour
 * to render the shell before the user does anything admin-like.
 * The RLS policy (app_config_select_same_org) mirrors that.
 *
 * PATCH is restricted to CONFIG_EDIT permission.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  parseBody,
  serverError,
  unauthorized,
  validationError,
} from '@/lib/api/response';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/guard';
import { PERMISSIONS } from '@/lib/auth/roles';
import { appConfigUpdateSchema, formatZodError } from '@/lib/validation/schemas';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return unauthorized();
  }

  const admin = createSupabaseAdminClient();
  const { data: config, error } = await admin
    .from('app_config')
    .select('*')
    .eq('org_id', profile.orgId)
    .single();

  if (error || !config) {
    return serverError('Could not load app configuration.');
  }

  return ok({ config });
}

export async function PATCH(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

  const guard = await requirePermission(PERMISSIONS.CONFIG_EDIT);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const parsed = appConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const input = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: updated, error: updateError } = await admin
    .from('app_config')
    .update({
      app_name: input.appName,
      support_email: input.supportEmail || null,
      default_language: input.defaultLanguage,
      timezone: input.timezone,
      primary_color: input.primaryColor,
      icon_letter: input.iconLetter,
      logo_url: input.logoUrl || null,
      favicon_url: input.faviconUrl || null,
      require_password_change_on_first_login: input.requirePasswordChangeOnFirstLogin,
      session_timeout_minutes: input.sessionTimeoutMinutes,
      enforce_password_complexity: input.enforcePasswordComplexity,
      limit_concurrent_sessions: input.limitConcurrentSessions,
      updated_by: actor.id,
    })
    .eq('org_id', actor.orgId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return serverError('Could not update configuration.');
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.CONFIG_UPDATE,
    targetType: 'app_config',
    targetId: actor.orgId,
    metadata: { app_name: input.appName, primary_color: input.primaryColor },
    ipAddress,
    userAgent,
  });

  return ok({ config: updated });
}
