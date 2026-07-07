/**
 * app/api/user/profile/route.ts
 * ─────────────────────────────────────────────────────────────
 * Self-service profile update. Users can change their own
 * display name and contact email — both are safe to self-edit.
 *
 * Fields that users CANNOT change here (admin-only):
 *   - username (identity; would break synthetic email)
 *   - role     (privilege; must go through /api/admin/users/[id]/role)
 *   - status   (suspend/reinstate via admin routes)
 *
 * The RLS policy profiles_update_self_safe_fields allows UPDATE
 * on profiles where id = auth.uid(), so this uses the
 * session-bound server client (not the admin client).
 * ─────────────────────────────────────────────────────────────
 */

import { z } from 'zod';
import {
  ok,
  parseBody,
  validationError,
  serverError,
  unauthorized,
  forbidden,
} from '@/lib/api/response';
import { requireSessionProfile, UnauthenticatedError, SuspendedAccountError } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { extractRequestContext } from '@/lib/auth/audit';

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty.')
    .max(120, 'Display name must be 120 characters or fewer.'),
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255)
    .optional()
    .or(z.literal('')),
});

export async function PATCH(request: Request) {
  extractRequestContext(request); // referenced for future audit log extension

  let actor;
  try {
    actor = await requireSessionProfile();
  } catch (err) {
    if (err instanceof UnauthenticatedError) return unauthorized();
    if (err instanceof SuspendedAccountError) return forbidden('Account suspended.');
    throw err;
  }

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof Response) return bodyResult;
  const { body } = bodyResult;

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { displayName, contactEmail } = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      contact_email: contactEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actor.id);

  if (error) return serverError('Could not update profile. Please try again.');

  return ok({ ok: true });
}

/** Returns the current user's own profile fields for the form. */
export async function GET() {
  let actor;
  try {
    actor = await requireSessionProfile();
  } catch (err) {
    if (err instanceof UnauthenticatedError) return unauthorized();
    if (err instanceof SuspendedAccountError) return forbidden('Account suspended.');
    throw err;
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, first_name, last_name, contact_email, role, department')
    .eq('id', actor.id)
    .single();

  if (error || !profile) return serverError('Could not load profile.');

  return ok({ profile });
}
