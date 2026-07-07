/**
 * lib/storage/upload.ts
 * ─────────────────────────────────────────────────────────────
 * Handles file uploads to Supabase Storage for the app's
 * branding assets (logo, favicon).
 *
 * Storage bucket layout:
 *   branding/{org_id}/logo.{ext}
 *   branding/{org_id}/favicon.{ext}
 *
 * The bucket should be created via the Supabase dashboard or a
 * migration and set to PUBLIC read with the RLS policy:
 *
 *   CREATE POLICY "public read"
 *     ON storage.objects FOR SELECT
 *     USING (bucket_id = 'branding');
 *
 *   CREATE POLICY "admin write"
 *     ON storage.objects FOR INSERT
 *     WITH CHECK (
 *       bucket_id = 'branding' AND
 *       (SELECT role FROM public.profiles WHERE id = auth.uid())
 *         IN ('admin', 'super_admin')
 *     );
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

const BUCKET = 'branding';

export type BrandingAsset = 'logo' | 'favicon';

const ALLOWED_TYPES: Record<BrandingAsset, string[]> = {
  logo: ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'],
  favicon: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
};

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface UploadBrandingResult {
  url: string;
  path: string;
}

export class StorageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUploadError';
  }
}

/**
 * Validates and uploads a branding asset to Supabase Storage.
 * Returns the public URL to store in app_config.
 *
 * @param orgId   The organisation this asset belongs to.
 * @param asset   'logo' or 'favicon'.
 * @param file    The File/Blob to upload.
 */
export async function uploadBrandingAsset(
  orgId: string,
  asset: BrandingAsset,
  file: File
): Promise<UploadBrandingResult> {
  // Validate MIME type
  const allowed = ALLOWED_TYPES[asset];
  if (!allowed.includes(file.type)) {
    throw new StorageUploadError(
      `Invalid file type "${file.type}" for ${asset}. Allowed: ${allowed.join(', ')}.`
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageUploadError(
      `File is too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 2 MB.`
    );
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${orgId}/${asset}.${ext}`;

  const admin = createSupabaseAdminClient();

  // upsert: true overwrites any existing asset with the same path
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    logger.error('[storage] upload failed', { path, error: error.message });
    throw new StorageUploadError(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  logger.info('[storage] branding asset uploaded', { orgId, asset, path });

  return { url: publicUrl, path };
}
