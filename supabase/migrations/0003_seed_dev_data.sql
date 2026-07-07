-- ════════════════════════════════════════════════════════════
-- 0003_seed_dev_data.sql
-- ────────────────────────────────────────────────────────────
-- LOCAL DEVELOPMENT ONLY. Do not run against production.
-- Creates a default organisation + app_config row.
--
-- The first super_admin user is intentionally NOT created here
-- via raw SQL, because auth.users must be created through the
-- Supabase Admin API (it handles password hashing, identities,
-- etc. correctly). Run `npm run seed:admin` after migrating —
-- see scripts/seed-admin.ts — to create the first super_admin.
-- ════════════════════════════════════════════════════════════

insert into public.organisations (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'acme', 'Acme Corp')
on conflict (id) do nothing;

insert into public.app_config (org_id, app_name, support_email, primary_color, icon_letter)
values (
  '00000000-0000-0000-0000-000000000001',
  'AppName',
  'support@acmecorp.com',
  '#6c4de6',
  'A'
)
on conflict (org_id) do nothing;
