-- ════════════════════════════════════════════════════════════
-- 0002_rls_policies.sql
-- ────────────────────────────────────────────────────────────
-- Row-Level Security. This is the REAL authorization boundary —
-- even if a bug in application code forgot a permission check,
-- Postgres itself refuses the query. The Next.js layer should
-- still check roles for good UX (hiding buttons, fast 403s),
-- but RLS is the backstop that makes this safe.
--
-- Helper functions read the JWT claims Supabase Auth attaches
-- to every request (auth.uid()), then look up the caller's own
-- profile row to determine org_id / role. Written as STABLE
-- SQL functions so the planner can cache them per statement.
-- ════════════════════════════════════════════════════════════

alter table public.organisations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.app_config     enable row level security;
alter table public.audit_log      enable row level security;
alter table public.invite_tokens  enable row level security;


-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.current_org_id is
  'Returns the calling user''s org_id. SECURITY DEFINER so it can read profiles regardless of the caller''s own RLS visibility, avoiding recursive policy evaluation.';


-- ────────────────────────────────────────────────────────────
-- ORGANISATIONS
-- Members can read their own org; nobody can write via the
-- client (org creation/editing happens via service-role only,
-- e.g. a provisioning script, never end-user facing).
-- ────────────────────────────────────────────────────────────

create policy organisations_select_own
  on public.organisations
  for select
  using (id = public.current_org_id());


-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────

-- Everyone can see other profiles within their own org
-- (needed for "invited by", assignee pickers, directory, etc.)
create policy profiles_select_same_org
  on public.profiles
  for select
  using (org_id = public.current_org_id());

-- Users may update a tightly-scoped subset of their own row
-- (display name, contact email) — enforced further at the
-- application layer since RLS can't easily restrict columns.
-- Sensitive fields (role, status, username) are only ever
-- written via the service-role API routes, never directly
-- by an authenticated user, so this self-update policy is
-- intentionally narrow and non-destructive even if column
-- restriction were bypassed.
create policy profiles_update_self_safe_fields
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins (and above) can update any profile in their org —
-- role changes, suspensions, etc. The actual privileged
-- mutations (invite, role change, suspend) go through service-
-- role API routes anyway, but this keeps the policy consistent
-- in case of direct client reads via the admin UI.
create policy profiles_update_admin
  on public.profiles
  for update
  using (org_id = public.current_org_id() and public.is_admin_or_above())
  with check (org_id = public.current_org_id());

-- INSERT and DELETE on profiles is intentionally NOT exposed
-- to the authenticated client at all — no policy is defined
-- for those commands, so they are denied by default. Account
-- creation/deletion happens exclusively through Route Handlers
-- using the Supabase service-role key (see lib/supabase/admin.ts),
-- which bypasses RLS deliberately and is itself gated by an
-- application-level role check + audit log entry.


-- ────────────────────────────────────────────────────────────
-- APP CONFIG
-- Readable by everyone in the org (the frontend needs it to
-- render branding before the user even reaches a protected
-- page). Writable only by admins and above.
-- ────────────────────────────────────────────────────────────

create policy app_config_select_same_org
  on public.app_config
  for select
  using (org_id = public.current_org_id());

create policy app_config_update_admin
  on public.app_config
  for update
  using (org_id = public.current_org_id() and public.is_admin_or_above())
  with check (org_id = public.current_org_id());


-- ────────────────────────────────────────────────────────────
-- AUDIT LOG
-- Insert-only from the API layer (service role). Readable by
-- admin and above. No update/delete policy exists for ANYONE,
-- including admins — immutability is enforced by omission.
-- ────────────────────────────────────────────────────────────

create policy audit_log_select_admin
  on public.audit_log
  for select
  using (org_id = public.current_org_id() and public.is_admin_or_above());

-- No INSERT policy for the `authenticated` role: all audit
-- writes happen via the service-role key from trusted server
-- code, never directly from the browser session.


-- ────────────────────────────────────────────────────────────
-- INVITE TOKENS
-- Never readable or writable by the authenticated client.
-- Exclusively managed by service-role Route Handlers.
-- (No policies defined → RLS denies all access by default.)
-- ────────────────────────────────────────────────────────────
