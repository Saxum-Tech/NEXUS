-- ════════════════════════════════════════════════════════════
-- 0004_storage_buckets.sql
-- ────────────────────────────────────────────────────────────
-- Creates the Supabase Storage bucket for branding assets
-- (logo, favicon) and applies RLS policies.
--
-- Bucket layout:
--   branding/{org_id}/logo.{ext}
--   branding/{org_id}/favicon.{ext}
--
-- Access rules:
--   • Public read — the frontend must be able to load logo/
--     favicon images without authentication (login page,
--     browser tab, email clients, etc.)
--   • Authenticated write — only admin and super_admin roles
--     can upload or overwrite assets. The actual API route
--     (app/api/admin/upload/route.ts) adds a second layer of
--     permission checking via requirePermission(CONFIG_EDIT).
-- ════════════════════════════════════════════════════════════

-- Create the branding bucket (idempotent).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- ── Storage RLS ────────────────────────────────────────────

-- Public read: anyone can fetch branding assets (no auth needed).
create policy "branding_public_read"
  on storage.objects
  for select
  using (bucket_id = 'branding');

-- Authenticated write: only admin / super_admin can upload.
-- Object path must start with the user's own org_id to prevent
-- one org from overwriting another org's assets.
create policy "branding_admin_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'branding'
    and (
      select role
      from public.profiles
      where id = auth.uid()
    ) in ('admin', 'super_admin')
    -- Enforce path scoping: objects must live under the
    -- authenticated user's org_id prefix.
    and (storage.foldername(name))[1] = (
      select org_id::text
      from public.profiles
      where id = auth.uid()
    )
  );

create policy "branding_admin_update"
  on storage.objects
  for update
  using (
    bucket_id = 'branding'
    and (
      select role
      from public.profiles
      where id = auth.uid()
    ) in ('admin', 'super_admin')
  );

create policy "branding_admin_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'branding'
    and (
      select role
      from public.profiles
      where id = auth.uid()
    ) in ('admin', 'super_admin')
  );
