/**
 * app/api/admin/upload/route.ts
 * ─────────────────────────────────────────────────────────────
 * Accepts a multipart/form-data POST with:
 *   asset: 'logo' | 'favicon'
 *   file:  the binary file
 *
 * Validates, uploads to Supabase Storage, then updates the
 * relevant url column in app_config and returns the public URL.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { PERMISSIONS } from '@/lib/auth/roles';
import { uploadBrandingAsset, StorageUploadError, type BrandingAsset } from '@/lib/storage/upload';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';
import { forbidden, serverError, badRequest, ok } from '@/lib/api/response';

const VALID_ASSETS: BrandingAsset[] = ['logo', 'favicon'];

export async function POST(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

  const guard = await requirePermission(PERMISSIONS.CONFIG_EDIT);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('Expected multipart/form-data.');
  }

  const asset = formData.get('asset') as string | null;
  const file = formData.get('file') as File | null;

  if (!asset || !VALID_ASSETS.includes(asset as BrandingAsset)) {
    return badRequest(`"asset" must be one of: ${VALID_ASSETS.join(', ')}.`);
  }

  if (!file || typeof file === 'string') {
    return badRequest('Missing "file" field.');
  }

  let result;
  try {
    result = await uploadBrandingAsset(actor.orgId, asset as BrandingAsset, file);
  } catch (err) {
    if (err instanceof StorageUploadError) {
      return badRequest(err.message);
    }
    return serverError('Upload failed. Please try again.');
  }

  // Persist the new URL to app_config
  const columnKey = asset === 'logo' ? 'logo_url' : 'favicon_url';
  const admin = createSupabaseAdminClient();
  const { error: configError } = await admin
    .from('app_config')
    .update({ [columnKey]: result.url, updated_by: actor.id })
    .eq('org_id', actor.orgId);

  if (configError) {
    return serverError('File uploaded but could not update config. Please try again.');
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.CONFIG_UPDATE,
    targetType: 'app_config',
    targetId: actor.orgId,
    metadata: { updated_field: columnKey, url: result.url },
    ipAddress,
    userAgent,
  });

  return ok({ url: result.url });
}
