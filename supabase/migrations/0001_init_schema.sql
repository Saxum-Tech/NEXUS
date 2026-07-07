-- ════════════════════════════════════════════════════════════
-- 0001_init_schema.sql
-- ────────────────────────────────────────────────────────────
-- Core schema for the enterprise app template.
--
-- Design summary:
--   • auth.users (Supabase-managed) stores ONE row per account.
--     The `email` column holds a SYNTHETIC address of the form
--     {username}__{org_id}@internal.invalid — never a real email,
--     never shown to the user, never used to communicate with them.
--   • public.profiles is the source of truth for everything the
--     app actually cares about: username, display name, real
--     contact email (duplicates allowed), role, org, status.
--   • There is no public sign-up. Rows in auth.users + profiles
--     are only ever created by an admin via the service-role
--     Supabase Admin API, from a Next.js Route Handler.
-- ════════════════════════════════════════════════════════════

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;


-- ────────────────────────────────────────────────────────────
-- ORGANISATIONS
-- One row per tenant. Even single-tenant deployments use this
-- so the synthetic email scheme and RLS policies stay identical
-- whether you later go multi-tenant or not.
-- ────────────────────────────────────────────────────────────
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,       -- used in synthetic email domain scoping
  name        text not null,
  created_at  timestamptz not null default now()
);

comment on table public.organisations is
  'Tenant boundary. Synthetic auth emails are scoped per-org so usernames only need to be unique within an org, not globally.';


-- ────────────────────────────────────────────────────────────
-- ROLE ENUM
-- Extend this list as needed; RLS policies reference these
-- values directly so keep migrations in sync with lib/auth/roles.ts
-- ────────────────────────────────────────────────────────────
create type public.app_role as enum ('super_admin', 'admin', 'editor', 'viewer');

create type public.user_status as enum ('active', 'invited', 'suspended');


-- ────────────────────────────────────────────────────────────
-- PROFILES
-- 1:1 with auth.users, keyed by the same id.
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  org_id            uuid not null references public.organisations(id) on delete cascade,

  username          text not null,
  display_name      text not null,
  first_name        text not null,
  last_name         text not null,

  -- Real contact email. Intentionally NOT unique — duplicates
  -- are an explicit product requirement (e.g. shared team inboxes).
  contact_email     text,

  role              public.app_role not null default 'viewer',
  status            public.user_status not null default 'invited',
  department        text,

  must_change_password boolean not null default true,

  invited_by        uuid references public.profiles(id),
  invited_at        timestamptz,
  activated_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint username_format check (username ~ '^[a-z0-9][a-z0-9.\-]{2,38}[a-z0-9]$'),
  constraint username_unique_per_org unique (org_id, username)
);

comment on table public.profiles is
  'Application-facing user record. auth.users.email is a synthetic, internal-only address derived from (username, org_id) — never use it for communication. Use contact_email instead, which intentionally permits duplicates.';

comment on column public.profiles.username is
  'Login identifier. Lowercase, dots/hyphens allowed. Unique per org, NOT globally unique.';

comment on column public.profiles.contact_email is
  'Real-world email for notifications only. Duplicates across users are allowed by design.';

create index profiles_org_id_idx on public.profiles(org_id);
create index profiles_status_idx on public.profiles(status);
create index profiles_role_idx on public.profiles(role);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────
-- APP CONFIG
-- Single-row-per-org table for dynamic branding/settings.
-- ────────────────────────────────────────────────────────────
create table public.app_config (
  org_id              uuid primary key references public.organisations(id) on delete cascade,

  app_name            text not null default 'AppName',
  support_email       text,
  default_language    text not null default 'en',
  timezone             text not null default 'UTC',

  logo_url             text,
  favicon_url          text,
  primary_color        text not null default '#6c4de6',
  icon_letter           text not null default 'A',

  allow_public_registration   boolean not null default false, -- always false; kept explicit for clarity/auditing
  require_password_change_on_first_login boolean not null default true,
  session_timeout_minutes     integer not null default 30,
  enforce_password_complexity boolean not null default true,
  limit_concurrent_sessions   boolean not null default false,

  updated_by           uuid references public.profiles(id),
  updated_at            timestamptz not null default now()
);

comment on table public.app_config is
  'Per-org dynamic configuration consumed at runtime by the frontend to theme/brand the app (name, colors, logo). Edited only via the admin settings screen.';

create trigger set_app_config_updated_at
  before update on public.app_config
  for each row
  execute procedure extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────
-- AUDIT LOG
-- Append-only. Never updated, never deleted by the app layer.
-- ────────────────────────────────────────────────────────────
create table public.audit_log (
  id              bigint generated always as identity primary key,
  org_id          uuid not null references public.organisations(id) on delete cascade,

  actor_id        uuid references public.profiles(id),
  actor_username  text,            -- denormalised snapshot, survives actor deletion
  actor_role      public.app_role,

  action          text not null,   -- e.g. 'user.invite', 'auth.login', 'config.update'
  target_type     text,            -- e.g. 'profile', 'app_config'
  target_id       text,

  metadata        jsonb not null default '{}'::jsonb,
  ip_address      inet,
  user_agent      text,

  created_at      timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only audit trail. Insert-only from the app; rely on RLS + lack of UPDATE/DELETE policies to enforce immutability.';

create index audit_log_org_id_idx on public.audit_log(org_id);
create index audit_log_actor_id_idx on public.audit_log(actor_id);
create index audit_log_action_idx on public.audit_log(action);
create index audit_log_created_at_idx on public.audit_log(created_at desc);


-- ────────────────────────────────────────────────────────────
-- INVITE TOKENS
-- Used for the "set your password" first-login flow.
-- Supabase's own recovery link mechanism is reused under the
-- hood (see lib/auth/invite.ts) but we track expiry/state
-- ourselves for clean admin visibility (resend, revoke, etc).
-- ────────────────────────────────────────────────────────────
create table public.invite_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  token_hash    text not null,         -- sha256 of the token; never store raw tokens
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index invite_tokens_profile_id_idx on public.invite_tokens(profile_id);
create unique index invite_tokens_token_hash_idx on public.invite_tokens(token_hash);

comment on table public.invite_tokens is
  'Tracks invite/setup-link lifecycle for admin visibility (pending/expired/resend) independent of Supabase internal recovery token storage.';
