/**
 * app/api/auth/login/route.ts
 * ─────────────────────────────────────────────────────────────
 * Username + password login. The client never sees or sends an
 * email address — this route resolves the synthetic email
 * server-side and hands it to Supabase's password grant.
 *
 * Also enforces two org-level settings from app_config that
 * need to be checked at login time:
 *   - limit_concurrent_sessions: signs out all other sessions
 *     before establishing the new one.
 *   - session_timeout_minutes: stamps an httpOnly cookie with
 *     the org's configured timeout in ms. Middleware reads this
 *     on every subsequent request to enforce inactivity limits
 *     without a DB query per request.
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
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { resolveLoginEmail } from '@/lib/auth/synthetic-email';
import { loginSchema, formatZodError } from '@/lib/validation/schemas';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';
import { rateLimitRequest } from '@/lib/auth/rate-limit';
import { env } from '@/lib/env';

const SESSION_TIMEOUT_COOKIE = 'app_session_timeout_ms';
const LAST_ACTIVITY_COOKIE = 'app_last_activity';

async function resolveOrgIdForRequest(): Promise<string> {
  const orgId = env.defaultOrgId;
  return orgId;
}

export async function POST(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

  // 10 attempts per IP per minute — blocks brute force while allowing
  // a user who genuinely mis-typed their password multiple times.
  const limit = rateLimitRequest(request, 'login', { max: 10, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { username, password } = parsed.data;
  const orgId = await resolveOrgIdForRequest();
  const syntheticEmail = resolveLoginEmail(username, orgId);

  const admin = createSupabaseAdminClient();

  // Load org config before signing in so we can enforce
  // concurrent-session policy and stamp the timeout cookie.
  const { data: config } = await admin
    .from('app_config')
    .select('limit_concurrent_sessions, session_timeout_minutes')
    .eq('org_id', orgId)
    .single();

  const limitConcurrent = config?.limit_concurrent_sessions ?? false;
  const timeoutMs = (config?.session_timeout_minutes ?? 30) * 60 * 1000;

  // Enforce limit_concurrent_sessions: revoke ALL existing sessions
  // for this user before creating the new one. We look up the
  // user by synthetic email to get their ID without needing a
  // session yet.
  if (limitConcurrent) {
    const { data: existingUser } = await admin.auth.admin.getUserByEmail(syntheticEmail);
    if (existingUser?.user) {
      await admin.auth.admin.signOut(existingUser.user.id, 'global');
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (error || !data.session) {
    await writeAuditEvent({
      orgId,
      actorId: null,
      actorUsername: username,
      actorRole: null,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: { reason: error?.message ?? 'unknown' },
      ipAddress,
      userAgent,
    });
    return unauthorized('Invalid username or password.');
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, role, status, must_change_password')
    .eq('id', data.user.id)
    .single();

  if (!profile || profile.status === 'suspended') {
    await supabase.auth.signOut();
    await writeAuditEvent({
      orgId,
      actorId: data.user.id,
      actorUsername: username,
      actorRole: profile?.role ?? null,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: { reason: 'account_suspended' },
      ipAddress,
      userAgent,
    });
    return forbidden('This account has been suspended. Contact your administrator.');
  }

  await writeAuditEvent({
    orgId,
    actorId: profile.id,
    actorUsername: profile.username,
    actorRole: profile.role,
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    ipAddress,
    userAgent,
  });

  const redirectTo = profile.must_change_password ? '/set-password' : '/dashboard';

  // Stamp the org's timeout value and initial activity timestamp
  // as httpOnly cookies so middleware can enforce inactivity
  // limits on every subsequent request without a DB hit.
  const cookieOpts = { httpOnly: true, sameSite: 'lax', path: '/' } as const;
  const jsonResponse = NextResponse.json({
    mustChangePassword: profile.must_change_password,
    redirectTo,
  });
  jsonResponse.cookies.set(SESSION_TIMEOUT_COOKIE, String(timeoutMs), cookieOpts);
  jsonResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), cookieOpts);

  return jsonResponse;
}
