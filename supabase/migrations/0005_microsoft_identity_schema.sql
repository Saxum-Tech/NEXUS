-- ════════════════════════════════════════════════════════════
-- 0005_microsoft_identity_schema.sql
-- ────────────────────────────────────────────────────────────
-- Microsoft 365 / Entra ID identity foundation for NEXUS.
--
-- Design summary:
--   • public.organisations remains the internal tenant boundary.
--   • public.microsoft_tenants maps each organisation to one
--     Microsoft Entra tenant without merging those identities.
--   • public.microsoft_user_links maps an internal profile to the
--     Microsoft user object (`oid`) used by Graph and Outlook.
--   • public.microsoft_consent_grants records tenant/user consent
--     metadata and scopes without storing raw access tokens.
--   • public.microsoft_graph_activity is append-only operational
--     telemetry for Graph actions. The existing audit_log remains
--     the canonical business audit trail.
--
-- Non-goals:
--   • No mailbox contents are persisted here.
--   • No OAuth refresh/access tokens are persisted here.
--   • No browser/client write access is granted to these tables.
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

create type public.microsoft_consent_status as enum (
  'not_configured',
  'pending_admin_consent',
  'active',
  'revoked',
  'error'
);

create type public.microsoft_link_status as enum (
  'active',
  'revoked',
  'error'
);

create type public.microsoft_consent_grant_type as enum (
  'delegated',
  'application'
);

create type public.microsoft_graph_action_status as enum (
  'success',
  'failure',
  'skipped'
);


-- ────────────────────────────────────────────────────────────
-- MICROSOFT TENANTS
-- One Microsoft Entra tenant connection per organisation for the
-- initial MVP. If a future enterprise deployment requires multiple
-- Microsoft tenants per organisation, replace the org_id unique
-- constraint with a partial/default tenant model in a later migration.
-- ────────────────────────────────────────────────────────────

create table public.microsoft_tenants (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.organisations(id) on delete cascade,

  entra_tenant_id            text not null,
  display_name               text,
  primary_domain             text,

  consent_status             public.microsoft_consent_status not null default 'not_configured',
  admin_consent_granted_at   timestamptz,
  last_consent_checked_at    timestamptz,

  last_error_at              timestamptz,
  last_error_code            text,
  last_error_message         text,

  created_by                 uuid references public.profiles(id) on delete set null,
  updated_by                 uuid references public.profiles(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint microsoft_tenants_org_unique unique (org_id),
  constraint microsoft_tenants_entra_tenant_id_unique unique (entra_tenant_id),
  constraint microsoft_tenants_entra_tenant_id_not_blank check (length(trim(entra_tenant_id)) > 0),
  constraint microsoft_tenants_primary_domain_not_blank check (primary_domain is null or length(trim(primary_domain)) > 0)
);

comment on table public.microsoft_tenants is
  'Maps a NEXUS organisation to its Microsoft Entra tenant. Stores tenant/consent metadata only; no OAuth tokens or mailbox data.';

comment on column public.microsoft_tenants.entra_tenant_id is
  'Microsoft Entra tenant id from token claim tid. Kept separate from public.organisations.id.';

comment on column public.microsoft_tenants.consent_status is
  'Operational state of Microsoft consent for this organisation. Used by setup screens and Graph guards.';

create index microsoft_tenants_org_id_idx on public.microsoft_tenants(org_id);
create index microsoft_tenants_consent_status_idx on public.microsoft_tenants(consent_status);

create trigger set_microsoft_tenants_updated_at
  before update on public.microsoft_tenants
  for each row
  execute procedure extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────
-- MICROSOFT USER LINKS
-- Links one internal profile to one Microsoft user object in the
-- connected Entra tenant. The profile remains the source of truth
-- for NEXUS permissions; Microsoft identity proves who the user is.
-- ────────────────────────────────────────────────────────────

create table public.microsoft_user_links (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.organisations(id) on delete cascade,
  microsoft_tenant_id        uuid not null references public.microsoft_tenants(id) on delete cascade,
  profile_id                 uuid not null references public.profiles(id) on delete cascade,

  entra_user_id              text not null,
  user_principal_name        text not null,
  mail                       text,
  display_name               text,

  consent_scopes             text[] not null default array[]::text[],
  status                     public.microsoft_link_status not null default 'active',

  consented_at               timestamptz,
  last_seen_at               timestamptz,
  revoked_at                 timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint microsoft_user_links_profile_unique unique (org_id, profile_id),
  constraint microsoft_user_links_entra_user_unique unique (microsoft_tenant_id, entra_user_id),
  constraint microsoft_user_links_entra_user_id_not_blank check (length(trim(entra_user_id)) > 0),
  constraint microsoft_user_links_upn_not_blank check (length(trim(user_principal_name)) > 0),
  constraint microsoft_user_links_revoked_at_required check (status <> 'revoked' or revoked_at is not null)
);

comment on table public.microsoft_user_links is
  'Maps a NEXUS profile to the Microsoft Entra user object used by Graph. NEXUS role/permission checks still come from public.profiles.';

comment on column public.microsoft_user_links.entra_user_id is
  'Microsoft Entra user object id from token claim oid.';

comment on column public.microsoft_user_links.consent_scopes is
  'Delegated Graph scopes consented for this user. Store scope names only, never tokens.';

create index microsoft_user_links_org_id_idx on public.microsoft_user_links(org_id);
create index microsoft_user_links_profile_id_idx on public.microsoft_user_links(profile_id);
create index microsoft_user_links_status_idx on public.microsoft_user_links(status);

create trigger set_microsoft_user_links_updated_at
  before update on public.microsoft_user_links
  for each row
  execute procedure extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────
-- MICROSOFT CONSENT GRANTS
-- Records delegated/application consent metadata and scope sets.
-- This supports setup auditing and future admin screens without
-- persisting OAuth token material.
-- ────────────────────────────────────────────────────────────

create table public.microsoft_consent_grants (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.organisations(id) on delete cascade,
  microsoft_tenant_id        uuid not null references public.microsoft_tenants(id) on delete cascade,

  grant_type                 public.microsoft_consent_grant_type not null,
  granted_by_profile_id      uuid references public.profiles(id) on delete set null,
  scopes                     text[] not null default array[]::text[],

  consented_at               timestamptz not null default now(),
  expires_at                 timestamptz,
  revoked_at                 timestamptz,

  metadata                   jsonb not null default '{}'::jsonb,
  created_at                 timestamptz not null default now(),

  constraint microsoft_consent_grants_scopes_not_null check (scopes is not null),
  constraint microsoft_consent_grants_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.microsoft_consent_grants is
  'Auditable Microsoft Graph consent metadata. Stores grant type, scopes and consent timestamps only; never stores OAuth tokens.';

create index microsoft_consent_grants_org_id_idx on public.microsoft_consent_grants(org_id);
create index microsoft_consent_grants_tenant_id_idx on public.microsoft_consent_grants(microsoft_tenant_id);
create index microsoft_consent_grants_grant_type_idx on public.microsoft_consent_grants(grant_type);
create index microsoft_consent_grants_consented_at_idx on public.microsoft_consent_grants(consented_at desc);


-- ────────────────────────────────────────────────────────────
-- MICROSOFT GRAPH ACTIVITY
-- Append-only technical telemetry for Graph calls. Use audit_log
-- for material business events such as escalation creation, policy
-- changes, approved reply sends, or privileged admin actions.
-- ────────────────────────────────────────────────────────────

create table public.microsoft_graph_activity (
  id                         bigint generated always as identity primary key,
  org_id                     uuid not null references public.organisations(id) on delete cascade,

  actor_id                   uuid references public.profiles(id) on delete set null,
  microsoft_tenant_id        uuid references public.microsoft_tenants(id) on delete set null,
  microsoft_user_link_id     uuid references public.microsoft_user_links(id) on delete set null,

  request_id                 text,
  operation                  text not null,
  resource_type              text not null,
  action_status              public.microsoft_graph_action_status not null,
  permission_snapshot        text[] not null default array[]::text[],

  metadata                   jsonb not null default '{}'::jsonb,
  error_code                 text,
  error_message              text,

  created_at                 timestamptz not null default now(),

  constraint microsoft_graph_activity_operation_not_blank check (length(trim(operation)) > 0),
  constraint microsoft_graph_activity_resource_type_not_blank check (length(trim(resource_type)) > 0),
  constraint microsoft_graph_activity_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.microsoft_graph_activity is
  'Append-only technical telemetry for Microsoft Graph calls. Do not store mailbox body content; use metadata for ids/status only.';

comment on column public.microsoft_graph_activity.permission_snapshot is
  'Graph scopes/permissions used or requested for the operation at execution time.';

create index microsoft_graph_activity_org_id_idx on public.microsoft_graph_activity(org_id);
create index microsoft_graph_activity_actor_id_idx on public.microsoft_graph_activity(actor_id);
create index microsoft_graph_activity_tenant_id_idx on public.microsoft_graph_activity(microsoft_tenant_id);
create index microsoft_graph_activity_operation_idx on public.microsoft_graph_activity(operation);
create index microsoft_graph_activity_action_status_idx on public.microsoft_graph_activity(action_status);
create index microsoft_graph_activity_created_at_idx on public.microsoft_graph_activity(created_at desc);


-- ────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- These tables are read-only from browser sessions and writable only
-- through trusted Route Handlers using the Supabase service-role key.
-- The application layer must still call requirePermission() before
-- exposing admin/setup views or Graph operations.
-- ────────────────────────────────────────────────────────────

alter table public.microsoft_tenants         enable row level security;
alter table public.microsoft_user_links      enable row level security;
alter table public.microsoft_consent_grants  enable row level security;
alter table public.microsoft_graph_activity  enable row level security;

-- Tenant/consent setup metadata is admin-only.
create policy microsoft_tenants_select_admin
  on public.microsoft_tenants
  for select
  using (org_id = public.current_org_id() and public.is_admin_or_above());

-- Users may read their own Microsoft link; admins can read all links in-org.
create policy microsoft_user_links_select_self_or_admin
  on public.microsoft_user_links
  for select
  using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.is_admin_or_above())
  );

create policy microsoft_consent_grants_select_admin
  on public.microsoft_consent_grants
  for select
  using (org_id = public.current_org_id() and public.is_admin_or_above());

create policy microsoft_graph_activity_select_admin
  on public.microsoft_graph_activity
  for select
  using (org_id = public.current_org_id() and public.is_admin_or_above());

-- No INSERT / UPDATE / DELETE policies are defined for authenticated users.
-- All writes are deliberately routed through server-side service-role code
-- after deterministic NEXUS permission checks and audit logging.
