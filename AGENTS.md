# Engineering Guidelines — Enterprise App Template

**Read this document before writing any code.**  
It describes every architectural decision, naming convention, pattern, and constraint enforced in this codebase. Deviation from these rules creates inconsistency, technical debt, and security gaps. When in doubt, follow what already exists — consistency beats cleverness.

---

## Table of Contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Directory structure](#3-directory-structure)
4. [TypeScript rules](#4-typescript-rules)
5. [Styling system](#5-styling-system)
6. [Component library](#6-component-library)
7. [Route Handlers (API)](#7-route-handlers-api)
8. [Authentication & authorisation](#8-authentication--authorisation)
9. [Supabase — client usage](#9-supabase--client-usage)
10. [Supabase — migrations](#10-supabase--migrations)
11. [Supabase — RLS policies](#11-supabase--rls-policies)
12. [Supabase — scripts & seeding](#12-supabase--scripts--seeding)
13. [Data fetching (client-side)](#13-data-fetching-client-side)
14. [Environment variables](#14-environment-variables)
15. [Logging](#15-logging)
16. [Error handling](#16-error-handling)
17. [Validation](#17-validation)
18. [Testing](#18-testing)
19. [File & import conventions](#19-file--import-conventions)
20. [What never to do](#20-what-never-to-do)

---

## 1. Project overview

A reusable enterprise web application foundation built on:

- **Next.js 15 App Router** — both frontend and server-side API in one codebase
- **Supabase** — Postgres database, Row-Level Security, Auth, and Storage
- **Invite-only authentication** — username + password, no public sign-up, no OAuth
- **Synthetic email system** — Supabase Auth requires an email field; a non-deliverable `{username}__{org_id}@internal.invalid` address is auto-generated server-side. Users never see or use it
- **Four-role RBAC** — `super_admin → admin → editor → viewer` enforced at both API and database layers
- **Single-tenant by default** — one `organisations` row per deployment, identified by `DEFAULT_ORG_ID` env var

**The golden rule:** Every security decision is enforced *twice* — once in application code and once in Postgres RLS. If you add a new privileged operation, add both.

---

## 2. Tech stack

| Concern | Tool | Version |
|---|---|---|
| Framework | Next.js App Router | ^15.0.3 |
| Language | TypeScript (strict) | ^5.6.3 |
| Database / Auth | Supabase | @supabase/ssr ^0.5.2 |
| Validation | Zod | ^3.23.8 |
| Styling | CSS Modules + design tokens | — |
| Testing | Vitest | ^2.1.2 |
| Linting | ESLint + @typescript-eslint | ^8.8.1 |
| Formatting | Prettier | ^3.3.3 |
| CI | GitHub Actions | — |

Never add a new dependency without a clear reason. Every dependency is a maintenance burden and a supply-chain risk. Prefer native Web APIs, built-in Node APIs, and what's already in the stack.

---

## 3. Directory structure

```
app/
  (admin)/              Admin-only routes. Layout enforces ADMIN_PANEL_ACCESS.
  (app)/                Authenticated user routes. Layout enforces valid session.
  api/
    admin/              Admin API routes. Every route calls requirePermission().
    auth/               Public/session auth routes.
    user/               Self-service user routes (read/write own data only).
  login/                Public. No session required.
  set-password/         Public. Token-authenticated.

components/
  layout/               PageShell, AdminSidebar, AdminSidebarClient.
  ui/                   All shared UI primitives. See §6.

lib/
  api/response.ts       Route Handler response helpers. Always use these.
  auth/
    audit.ts            writeAuditEvent(). Call after every privileged action.
    guard.ts            requirePermission(). Call at the top of every admin route.
    invite.ts           Setup-link token creation and verification.
    rate-limit.ts       Sliding-window in-memory rate limiter.
    roles.ts            Permission matrix. Single source of truth for RBAC.
    session.ts          requireSessionProfile() / getSessionProfile().
    synthetic-email.ts  Username ↔ synthetic email conversion.
  config/
    get-app-config.ts   Fetch org branding/config server-side.
  email/
    send-invite-email.ts  Email delivery abstraction. Swap provider here only.
  env.ts                Validated env var access. Never use process.env directly.
  hooks/
    useApiMutation.ts   Client-side POST/PATCH/DELETE state management.
    useApiQuery.ts      Client-side GET with debounce and abort.
  logger.ts             Structured JSON logger. Never use console.* directly.
  storage/upload.ts     Supabase Storage upload helper.
  supabase/
    admin.ts            Service-role client. Server-only. Bypasses RLS.
    server.ts           Session-bound client. Respects RLS.
  validation/schemas.ts Zod schemas for every API request body.

scripts/                tsx scripts. Not bundled. Not imported by app code.
styles/
  globals.css           Reset and base styles only.
  tokens.css            ALL design tokens. The only place hardcoded values live.
supabase/
  config.toml           Local dev config for `supabase start`.
  migrations/           Numbered SQL files. Append-only. Never edit old ones.
types/
  database.ts           Hand-written DB types. Regenerate with `npm run db:types`.
```

---

## 4. TypeScript rules

**Strict mode is on. Every rule in `tsconfig.json` is enforced.**

### Do

```typescript
// Explicit return types on all exported functions
export async function createUser(input: CreateUserInput): Promise<UserRow> { ... }

// Discriminated unions for results that can fail
type GuardResult =
  | { ok: true; profile: SessionProfile }
  | { ok: false; response: NextResponse };

// Consistent type imports
import type { AppRole } from '@/lib/auth/roles';

// Narrow unknown carefully
if (err instanceof Error) logger.error(err.message);

// Prefer const assertions for literal types
const APP_ROLES = ['super_admin', 'admin', 'editor', 'viewer'] as const;
type AppRole = (typeof APP_ROLES)[number];
```

### Do not

```typescript
// Never use `any` in application code
const data: any = await response.json();  // ✗

// Never use non-null assertion outside of lib/env.ts
const url = process.env.SUPABASE_URL!;  // ✗ — use env.supabaseUrl instead

// Never use `as unknown as T` to escape the type system
const profile = result as unknown as Profile;  // ✗

// Never suppress errors silently
} catch (_) {}  // ✗ — at minimum: } catch (err) { logger.error(...) }
```

### Shared types

- **`AppRole`** — `'super_admin' | 'admin' | 'editor' | 'viewer'` — from `lib/auth/roles.ts`
- **`UserStatus`** — `'invited' | 'active' | 'suspended'` — from `lib/auth/roles.ts`
- **`Permission`** — union of all `PERMISSIONS` values — from `lib/auth/roles.ts`
- **`SessionProfile`** — the resolved current user — from `lib/auth/session.ts`
- **Database types** — `types/database.ts` — regenerate with `npm run db:types` after schema changes

---

## 5. Styling system

### Design tokens

**All visual values live in `styles/tokens.css`.** Never hardcode colours, sizes, radii, or shadows anywhere else.

```css
/* ✓ Correct */
.card { background: var(--color-surface-1); border-radius: var(--radius-lg); }

/* ✗ Wrong */
.card { background: #ffffff; border-radius: 12px; }
```

#### Full token reference

**Colours:**
```
--color-brand              Primary action colour (overridden at runtime from DB)
--color-brand-subtle       Light brand tint (badge backgrounds, hover states)
--color-brand-border       Brand border at low opacity
--color-brand-ring         Focus ring colour

--color-bg                 Page background
--color-surface-1          Card / panel background (white)
--color-surface-2          Subtle fill (input backgrounds, table headers)
--color-surface-3          Slightly darker fill (skeleton base)

--color-border-subtle      Very faint divider
--color-border             Standard border
--color-border-strong      Input borders, strong separators

--color-text-primary       Body text
--color-text-secondary     Labels, secondary copy
--color-text-tertiary      Hints, placeholders, metadata
--color-text-inverse       White text on dark backgrounds

--color-success / -bg / -border
--color-danger  / -bg / -border
--color-warning / -bg / -border
--color-info    / -bg / -border

--color-admin-bg           Admin sidebar background (#13152a)
--color-admin-border       Admin sidebar border
--color-admin-text         Admin sidebar body text
--color-admin-text-muted   Admin sidebar secondary text
--color-admin-hover        Admin sidebar hover state
--color-admin-active       Admin sidebar active item
```

**Typography:**
```
--font-sans    System sans-serif stack
--font-mono    Monospace stack (code, usernames)

--text-xs      11px
--text-sm      12px
--text-base    13px   ← default body text
--text-md      14px
--text-lg      16px
--text-xl      18px   ← page titles
--text-2xl     22px
--text-3xl     26px   ← metric values

--font-medium    500
--font-semibold  600
--font-bold      700

--leading-tight   1.25
--leading-normal  1.5
--leading-relaxed 1.75
```

**Spacing:**
```
--space-1   4px
--space-2   8px
--space-3   12px
--space-4   16px   ← standard page padding
--space-5   20px
--space-6   24px
--space-8   32px
--space-12  48px
```

**Borders & shadows:**
```
--radius-sm    4px
--radius       8px    ← buttons, inputs
--radius-md    10px
--radius-lg    12px   ← cards, panels
--radius-full  9999px ← badges, pills, avatars

--shadow-md    subtle card shadow
--shadow-lg    floating elements
--shadow-xl    modals, dialogs
```

**Layout:**
```
--sidebar-width   224px
--topbar-height   56px
--transition-fast 0.1s ease
--transition-base 0.2s ease
```

### CSS Modules

Every component has a co-located `.module.css` file. CSS is scoped; no global class names except what's in `globals.css`.

```
components/ui/Button.tsx          ← component
components/ui/Button.module.css   ← its styles
```

### Inline styles — strict rule

**Inline `style={{}}` is forbidden** except in these three documented cases:

1. `app/global-error.tsx` — CSS pipeline may be unavailable when root layout crashes
2. `style={{ background: form.primaryColor }}` in settings — runtime dynamic value from state
3. `style={{ width: '...' }}` on `<Skeleton>` — dynamic sizing is the point of the `style` prop

Every other visual value belongs in a CSS module class using design tokens. If you find yourself writing `style={{ padding: 16 }}`, stop and add a CSS class instead.

---

## 6. Component library

### Import always from the barrel

```typescript
// ✓ Correct
import { Button, Alert, Badge, Card } from '@/components/ui';
import { PageShell } from '@/components/layout';

// ✗ Wrong — imports directly from file
import { Button } from '@/components/ui/Button';
```

### Available components

| Component | Purpose |
|---|---|
| `Alert` | Success / error / warning / info message boxes. Replaces all ad-hoc `<div style={{ background: ... }}>` patterns |
| `Avatar` | User initials or image. Replaces ad-hoc initials divs |
| `Badge` | Role, status, and label pills. Accepts `variant` and optional `dot` |
| `Button` | All buttons. Accepts `variant`, `size`, `loading`, `fullWidth` |
| `Card` | White panel with border. Accepts optional `title`, `subtitle`, `actions` |
| `ConfirmDialog` | Replaces all `window.confirm()` calls. Portal to `document.body` |
| `EmptyState` | Shown when a list has no items. Always include an `action` |
| `MetricCard` | Stat display on dashboards and overview pages |
| `Pagination` | Client-side paginator with `onPageChange` callback |
| `LinkPagination` | Server-side paginator with `basePath` for `<a>` tags |
| `PasswordStrength` | Live password strength bar + checklist. Place below password inputs |
| `Select` | Styled `<select>`. Visually identical to `TextField` |
| `Skeleton` | Loading placeholder. Use in `loading.tsx` files |
| `Spinner` | Inline loading indicator. Use for async actions without full-page load |
| `TextField` | All text, email, password inputs. Includes label, hint, error |
| `Toast` | Success confirmation. Portals to `document.body`, auto-dismisses |
| `UploadZone` | Drag-and-drop file upload to `/api/admin/upload` |
| `PageShell` | Wraps every authenticated page. Provides padding, title row, actions slot |

### Rules for adding new components

1. Create `ComponentName.tsx` and `ComponentName.module.css` together
2. Export from `components/ui/index.ts` (barrel) immediately
3. Use only design tokens in the CSS module — no hardcoded values
4. Accept `className?: string` so callers can extend layout without overriding internals
5. Add a JSDoc comment describing when to use it and when NOT to

### When to add a new component vs inline

Add a component when the pattern appears **in two or more places**, or when it encapsulates non-trivial logic (accessibility, portals, debounce). One-off layout elements can stay inline as CSS module classes.

---

## 7. Route Handlers (API)

### File location

```
app/api/
  auth/          Public + session-auth routes (login, logout, set-password)
  admin/         Admin-only routes (require permission checks)
  user/          Self-service routes (user reads/writes their own data)
  health/        Health check (no auth)
```

### Standard route structure

Every Route Handler follows this exact order:

```typescript
export async function POST(request: Request) {
  // 1. Extract request context (for audit log and rate limiting)
  const { ipAddress, userAgent } = extractRequestContext(request);

  // 2. Rate limit (auth routes only)
  const limit = rateLimitRequest(request, 'action-name', { max: 10, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  // 3. Parse and validate body
  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const parsed = mySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // 4. Authenticate + authorise
  const guard = await requirePermission(PERMISSIONS.USER_INVITE);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  // 5. Business logic
  const { data, error } = await admin.from('profiles').insert({ ... });
  if (error) return serverError('Could not create user.');

  // 6. Audit log
  await writeAuditEvent({ ... });

  // 7. Response
  return created({ user: data });
}
```

### Response helpers — always use these

```typescript
import {
  ok, created, noContent,
  badRequest, validationError, unauthorized, forbidden,
  notFound, conflict, tooManyRequests, serverError,
  parseBody,
} from '@/lib/api/response';

// ✓ Correct
return badRequest('Username is required.');
return validationError(parsed.error);
return forbidden('You cannot assign the super_admin role.');
return ok({ users: data, pagination });
return created({ user: newUser });

// ✗ Wrong — never use NextResponse.json directly in route handlers
return NextResponse.json({ error: 'bad' }, { status: 400 });
```

**Exception:** `app/api/auth/login/route.ts` uses `NextResponse.json` directly because it needs to set `Set-Cookie` headers on the response object — the `ok()` helper doesn't support that.

### Error shape

Every error response has this shape, which all client-side code depends on:

```json
{ "error": "Human-readable message" }
{ "error": "Validation failed.", "issues": [{ "field": "username", "message": "Required" }] }
```

---

## 8. Authentication & authorisation

### Session resolution

```typescript
import { requireSessionProfile, getSessionProfile,
         UnauthenticatedError, SuspendedAccountError } from '@/lib/auth/session';

// In Server Components and Route Handlers — throws on failure
const profile = await requireSessionProfile();
// profile: { id, orgId, username, displayName, role, ... }

// In layouts that need to redirect rather than throw
try {
  const profile = await requireSessionProfile();
} catch (err) {
  if (err instanceof UnauthenticatedError) redirect('/login');
  if (err instanceof SuspendedAccountError) redirect('/login?suspended=1');
  throw err;
}

// When you want null instead of throw
const profile = await getSessionProfile(); // returns null if not authenticated
```

### Permission checks in Route Handlers

```typescript
import { requirePermission } from '@/lib/auth/guard';
import { PERMISSIONS } from '@/lib/auth/roles';

// Returns discriminated union — check ok before using profile
const guard = await requirePermission(PERMISSIONS.USER_INVITE);
if (!guard.ok) return guard.response; // 401 or 403 already set

const actor = guard.profile; // SessionProfile — safe to use
```

### Permission reference

```
user:invite             Invite new users
user:edit               Edit user profiles
user:suspend            Suspend / reinstate users
user:delete             Permanently delete users
user:reset_password     Reset any user's password
role:assign             Assign / change roles
role:manage             View and manage the permission matrix
record:view             View all records
record:create           Create records
record:edit             Edit records
record:delete           Delete records
record:export           Export data
config:edit             Edit app settings and branding
audit:view              View the audit log
admin:access            Access the admin panel
api_keys:manage         Manage API keys
```

### Role hierarchy

```
super_admin  →  admin  →  editor  →  viewer
```

An actor can only assign roles **at or below their own rank**. An actor can only act on users **strictly below their own rank**. These rules are enforced by `canAssignRole()` and `canActOnUser()` in `lib/auth/roles.ts` — always use them, never re-implement the logic inline.

### Audit logging

Every privileged action that changes state **must** write an audit event:

```typescript
import { writeAuditEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';

await writeAuditEvent({
  orgId:         actor.orgId,
  actorId:       actor.id,
  actorUsername: actor.username,
  actorRole:     actor.role,
  action:        AUDIT_ACTIONS.USER_SUSPENDED,
  targetType:    'profile',
  targetId:      targetUser.id,
  metadata:      { reason: 'policy violation' },  // optional extra context
  ipAddress,
  userAgent,
});
```

`writeAuditEvent` never throws — it logs a warning if the write fails and continues. Do not wrap it in try/catch; do not await it before returning a response in performance-sensitive paths (fire-and-forget is acceptable for audit events).

### Synthetic email system

Users log in with a username. Supabase Auth requires an email internally. The bridge:

```typescript
import { buildSyntheticEmail, resolveLoginEmail } from '@/lib/auth/synthetic-email';

// Server-side only — never call from client components
const email = buildSyntheticEmail('jane.doe', orgId);
// → 'jane.doe__00000000-0000-0000-0000-000000000001@internal.invalid'
```

**Never** expose synthetic emails to the user. **Never** use them for contact. **Never** send real emails to `@internal.invalid` addresses. Contact emails are stored separately in `profiles.contact_email`.

---

## 9. Supabase — client usage

### Two clients, two purposes

```typescript
// 1. RLS-RESPECTING (session-bound) — use for anything a logged-in user reads/writes
import { createSupabaseServerClient } from '@/lib/supabase/server';
const supabase = await createSupabaseServerClient();
// → Can only see rows the user's RLS policies allow

// 2. SERVICE ROLE (admin) — use ONLY for privileged operations the user can't do themselves
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
const admin = createSupabaseAdminClient();
// → Bypasses ALL RLS. Treat like root database access.
```

### Decision rule

| Operation | Client to use |
|---|---|
| User reads their own profile | `createSupabaseServerClient()` |
| Admin reads any user's profile | `createSupabaseAdminClient()` |
| Creating a new auth.users row | `createSupabaseAdminClient()` — requires service role |
| Suspending a user (signOut global) | `createSupabaseAdminClient()` |
| User updates their own contact email | `createSupabaseServerClient()` — RLS enforces they can only update their own row |
| Health check (check DB is reachable) | `createSupabaseAdminClient()` — no session to rely on |

**Never** import `createSupabaseAdminClient` in client components or any file that runs in the browser. The module has `import 'server-only'` at the top, which will throw at build time if you try.

### Query patterns

```typescript
// Always handle errors — never assume success
const { data, error } = await admin
  .from('profiles')
  .select('id, username, role, status')
  .eq('org_id', actor.orgId)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .range(from, from + PAGE_SIZE - 1);

if (error) {
  logger.error('[profiles] query failed', { error: error.message, orgId: actor.orgId });
  return serverError('Could not load users.');
}

// Typed via the generated types in types/database.ts
// Regenerate after any schema change: npm run db:types
```

---

## 10. Supabase — migrations

### Naming convention

```
supabase/migrations/
  0001_init_schema.sql       Core tables
  0002_rls_policies.sql      Row-Level Security
  0003_seed_dev_data.sql     Local dev seed data only
  0004_storage_buckets.sql   Storage bucket creation + RLS
  0005_add_feature_x.sql     ← your next migration
```

**Rules — read carefully before touching migrations:**

1. **Append-only.** Never edit a migration that has been applied to any environment. If you need to change something, write a new migration.
2. **One concern per file.** Schema changes in one file, RLS changes in another. Mixing them makes rollback harder.
3. **Always idempotent where possible.** Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
4. **No data in schema migrations.** Dev seed data goes in `0003_seed_dev_data.sql` (or a new seed file). Production seed data (e.g. the first super_admin) goes in `scripts/seed-admin.ts`.
5. **Apply locally first.** Run `npm run db:reset` locally, verify the app works, then commit.
6. **Regenerate types after every schema change.** Run `npm run db:types` and commit the updated `types/database.ts`.

### New table template

```sql
-- 0005_add_api_keys.sql
-- ─────────────────────────────────────────────────────────────
-- Adds the api_keys table for scoped programmatic access tokens.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.api_keys (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  name           text not null check (length(name) between 1 and 120),
  key_hash       text not null unique,  -- SHA-256 of the raw key; raw never stored
  scopes         text[] not null default '{}',
  last_used_at   timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- Always add comments to columns whose purpose isn't obvious
comment on column public.api_keys.key_hash is
  'SHA-256 hex digest of the raw bearer token. Raw token is shown to the user once on creation and never stored.';

-- Row-level index on org_id (present on every multi-tenant table)
create index if not exists api_keys_org_id_idx on public.api_keys(org_id);

-- Enable RLS immediately — never leave a table without it
alter table public.api_keys enable row level security;
```

### Adding RLS to a new table (in a separate migration or `0002_rls_policies.sql`)

See §11.

### Applying migrations

```bash
# Against the local Supabase instance
npm run db:migrate          # npx supabase db push

# Reset local DB and re-apply all migrations + seed
npm run db:reset            # npx supabase db reset

# Against the hosted Supabase project (production / staging)
npx supabase db push --db-url "$SUPABASE_DB_URL"

# Regenerate TypeScript types after schema changes
npm run db:types            # npx supabase gen types typescript --local > types/database.ts
```

---

## 11. Supabase — RLS policies

**Every table must have RLS enabled and at least one policy.** A table with `alter table ... enable row level security` and no policies effectively denies all access — which is the safe default, but you must be intentional about it.

### Helper functions available in policies

These are defined in `0002_rls_policies.sql` and available in all subsequent policies:

```sql
public.current_org_id()   -- uuid: the org_id of the currently authenticated profile
public.current_role()     -- text: the role of the currently authenticated profile
public.is_admin_or_above() -- boolean: role IN ('admin', 'super_admin')
public.is_super_admin()   -- boolean: role = 'super_admin'
```

### Standard policy pattern for org-scoped tables

```sql
-- READ: any authenticated member of the org can read
create policy "org_members_read"
  on public.api_keys
  for select
  using (org_id = public.current_org_id());

-- INSERT: only admin and above
create policy "admin_insert"
  on public.api_keys
  for insert
  with check (
    org_id = public.current_org_id()
    and public.is_admin_or_above()
  );

-- UPDATE: only admin and above, own org only
create policy "admin_update"
  on public.api_keys
  for update
  using (
    org_id = public.current_org_id()
    and public.is_admin_or_above()
  );

-- DELETE: only super_admin
create policy "super_admin_delete"
  on public.api_keys
  for delete
  using (
    org_id = public.current_org_id()
    and public.is_super_admin()
  );
```

### Self-service update pattern

When a user can update only specific fields on their own row (e.g. profile):

```sql
-- Users can update their own display_name and contact_email only.
-- Role, status, username — admin-only via the service-role client.
create policy "profiles_update_self_safe_fields"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = public.current_org_id()
    -- role and status must not change (enforced by not being in the allowed columns)
  );
```

### Policy naming convention

```
{table}_{operation}_{actor}
  profiles_read_org_member
  profiles_update_self_safe_fields
  profiles_admin_update_any
  audit_log_insert_any_member
  audit_log_read_admin
```

### Testing RLS policies

After writing new policies, verify them with the Supabase Studio SQL editor using `set local role authenticated; set local "request.jwt.claims" to '{"sub": "USER_UUID"}';` to impersonate a specific user.

---

## 12. Supabase — scripts & seeding

### Script location and format

All scripts live in `scripts/`. They run via `tsx` and are **not bundled** — they cannot import client-only or browser-only code.

```bash
# Run any script
npx tsx scripts/my-script.ts

# Or via npm run if registered in package.json
npm run seed:admin -- --username admin --password 'Strong-P4ss!'
```

### Script template

```typescript
/**
 * scripts/do-something.ts
 * ─────────────────────────────────────────────────────────────
 * One-line description of what this script does.
 * Usage: npx tsx scripts/do-something.ts [options]
 * ─────────────────────────────────────────────────────────────
 */

import { config } from 'dotenv';
config({ path: '.env.local' }); // Must be first — loads env before any imports

import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey  = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Scripts always use the service-role client (they run as a human operator, not
// as an authenticated user, so RLS would deny everything)
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Parse CLI args
const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

async function main() {
  // ... script body

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
```

### Seeding rules

- **`0003_seed_dev_data.sql`** — local dev data only. Never referenced in production. Contains the default org row and app_config row with `org_id = '00000000-0000-0000-0000-000000000001'`.
- **`scripts/seed-admin.ts`** — bootstraps the first `super_admin` account. Idempotent (checks if user already exists before creating). Safe to run in production.
- **Never seed production data in SQL migrations.** Migrations are schema, not data.

---

## 13. Data fetching (client-side)

### useApiQuery — for GET requests

```typescript
import { useApiQuery } from '@/lib/hooks';

const { data, isLoading, error, refetch } = useApiQuery<UsersResponse>(
  '/api/admin/users',
  { search, page },          // re-fetches when these change (debounced 300ms)
  { debounceMs: 300 }        // optional, 250ms default
);

// Always handle all three states
if (isLoading) return <Spinner centered />;
if (error)     return <Alert variant="danger">{error}</Alert>;
if (!data || data.users.length === 0) return <EmptyState title="No users" />;
```

### useApiMutation — for POST/PATCH/DELETE

```typescript
import { useApiMutation } from '@/lib/hooks';

const { mutate, isLoading, error } = useApiMutation(
  `/api/admin/users/${userId}/suspend`,
  'POST',
  {
    onSuccess: () => { setToast('User suspended.'); refetch(); },
    onError:   (msg) => setError(msg),
  }
);

<Button loading={isLoading} onClick={() => mutate()}>Suspend</Button>
```

### Server Components — direct Supabase calls

Server Components can call Supabase directly — no API route needed for read-only data fetched at render time:

```typescript
// app/(admin)/admin/page.tsx — Server Component
const admin = createSupabaseAdminClient();
const { data, count } = await admin
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('org_id', profile.orgId);
```

### When to use Server Component vs client fetch

| Scenario | Pattern |
|---|---|
| Read-only data for initial page render | Server Component, direct Supabase call |
| Data that changes based on user interaction (search, pagination, filters) | Client component, `useApiQuery` |
| State-changing action triggered by user | Client component, `useApiMutation` |
| Data needed in multiple places on the same page | Pass as props from Server Component |

---

## 14. Environment variables

### Never access `process.env` directly in application code

```typescript
// ✓ Correct — validated at startup, throws with a clear message if missing
import { env } from '@/lib/env';
const client = createClient(env.supabaseUrl, env.supabaseAnonKey);

// ✗ Wrong — silently undefined if missing, non-null assertion is a lie
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
```

### `lib/env.ts` exports

```typescript
env.supabaseUrl          // NEXT_PUBLIC_SUPABASE_URL  (required)
env.supabaseAnonKey      // NEXT_PUBLIC_SUPABASE_ANON_KEY  (required)
env.supabaseServiceRoleKey  // SUPABASE_SERVICE_ROLE_KEY  (required, server-only)
env.appUrl               // NEXT_PUBLIC_APP_URL  (required)
env.defaultOrgId         // DEFAULT_ORG_ID  (required)
env.appName              // NEXT_PUBLIC_APP_NAME  (optional, defaults to 'AppName')
```

### Adding a new required env var

1. Add to `lib/env.ts` using `required('VAR_NAME')`
2. Add to `.env.example` with a description
3. Add to the CI workflow's `env:` block with a placeholder value
4. Document in `README.md`

### Client vs server vars

- `NEXT_PUBLIC_*` — bundled into the client. Safe for the browser. Use for Supabase URL and anon key only.
- Everything else — server-only. **Never** prefix secret keys with `NEXT_PUBLIC_`. The service role key would be exposed in the browser bundle.

---

## 15. Logging

### Never use `console.*` in production code paths

```typescript
// ✓ Correct
import { logger } from '@/lib/logger';
logger.info('[users] user invited', { username, role, orgId });
logger.warn('[storage] upload size close to limit', { sizeBytes, limit });
logger.error('[config] could not load app_config', { orgId, err: error.message });

// ✗ Wrong
console.log('User invited:', username);
console.error('Failed:', error);
```

### Exceptions (explicitly annotated with `// eslint-disable-next-line no-console`)

- `app/error.tsx` and `app/global-error.tsx` — error boundaries run before the logger may be initialised
- `scripts/*.ts` — scripts run in a terminal context, `console.log` is appropriate

### Log levels

```typescript
logger.debug(msg, ctx)  // Development tracing. Strip before production if verbose.
logger.info(msg, ctx)   // Normal operations: user invited, login succeeded, config updated.
logger.warn(msg, ctx)   // Degraded operations: fallback used, non-critical failure.
logger.error(msg, ctx)  // Errors that need attention: DB write failed, upstream timeout.
```

### Context object conventions

```typescript
// Always include the relevant IDs so logs are searchable
logger.error('[invite] failed to create auth user', {
  orgId:    actor.orgId,
  username: input.username,
  err:      createAuthError.message,
});
```

### Swapping to a real provider

Open `lib/logger.ts` and replace the `emit()` function body. The rest of the codebase doesn't change:

```typescript
// Axiom example
import { Axiom } from '@axiomhq/js';
const axiom = new Axiom({ token: process.env['AXIOM_TOKEN']! });
function emit(payload: LogPayload) {
  axiom.ingest('logs', [{ ...payload, _time: new Date().toISOString() }]);
}
```

---

## 16. Error handling

### In Route Handlers

Every route must handle errors — never let an unhandled exception reach the client. Use the response helpers:

```typescript
const { data, error } = await admin.from('profiles').select('*').eq('id', id).single();

if (error || !data) {
  logger.error('[profile] fetch failed', { id, err: error?.message });
  return notFound('User not found.');
}
```

### In Server Components

Supabase errors should be handled gracefully. Use a fallback or redirect:

```typescript
const { data: config } = await supabase.from('app_config').select('*').eq('org_id', orgId).single();
const appName = config?.app_name ?? env.appName; // safe fallback
```

### Error boundaries

- `app/error.tsx` — catches rendering errors in `(app)` and `(admin)` routes. Shows a "Try again" button.
- `app/global-error.tsx` — catches errors in the root layout itself. Uses inline styles because the CSS pipeline may have crashed.
- `app/not-found.tsx` — shown for unmatched routes.

Do not remove or simplify these. They are the last line of defence against blank screens.

### Never swallow errors silently

```typescript
// ✗ Wrong
try {
  await writeAuditEvent({ ... });
} catch (_) {}

// ✓ Correct — writeAuditEvent already handles its own errors internally.
// For your own error paths:
try {
  await riskyOperation();
} catch (err) {
  logger.error('[context] operation failed', { err: String(err) });
  return serverError('Operation failed. Please try again.');
}
```

---

## 17. Validation

### All API input is validated with Zod

```typescript
// lib/validation/schemas.ts — add all schemas here
import { z } from 'zod';

export const inviteUserSchema = z.object({
  username:     usernameSchema,
  firstName:    z.string().trim().min(1).max(60),
  lastName:     z.string().trim().min(1).max(60),
  role:         z.enum(['admin', 'editor', 'viewer']),
  contactEmail: z.string().email().optional().or(z.literal('')),
  department:   z.string().trim().max(80).optional().or(z.literal('')),
});
```

```typescript
// In the Route Handler
const parsed = inviteUserSchema.safeParse(body);
if (!parsed.success) return validationError(parsed.error);
const input = parsed.data; // typed and safe
```

### Password validation is org-aware

The password schema depends on the org's `enforce_password_complexity` setting:

```typescript
import { buildPasswordSchema, buildSetPasswordSchema } from '@/lib/validation/schemas';

// Load the org config FIRST, then build the schema
const { data: config } = await admin.from('app_config')
  .select('enforce_password_complexity').eq('org_id', orgId).single();

const enforceComplexity = config?.enforce_password_complexity ?? true; // fail-safe: strict

const schema = buildSetPasswordSchema(enforceComplexity);
const parsed = schema.safeParse(body);
```

Never use `setPasswordSchema` (the static export) in a route that has access to the org's config — always use `buildSetPasswordSchema(enforceComplexity)`.

### Client-side validation is for UX only

`PasswordStrength` and field-level hints exist to help users. The server always validates independently. Never trust client-side validation as a security control.

---

## 18. Testing

### Test file location

```
lib/auth/__tests__/synthetic-email.test.ts
lib/auth/__tests__/roles.test.ts
lib/auth/__tests__/rate-limit.test.ts
lib/auth/__tests__/password-strength.test.ts
```

All test files live in `__tests__/` directories adjacent to the code they test.

### What to test

Test the modules where a bug would be most damaging and that have no external dependencies:

- `lib/auth/roles.ts` — the permission matrix and privilege-escalation guards
- `lib/auth/synthetic-email.ts` — username validation and cross-org collision prevention
- `lib/auth/rate-limit.ts` — sliding window and per-key isolation
- `lib/validation/schemas.ts` — edge cases in password and username validation

Do not test Next.js Route Handlers, Supabase queries, or React components in unit tests — these require integration tests with a real server and database. They belong in a separate e2e test suite.

### Running tests

```bash
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report
```

### Coverage thresholds (enforced in CI)

```
Lines:     85%
Functions: 85%
Branches:  80%
```

Coverage is measured only on the pure-logic modules listed in `vitest.config.ts`. Do not lower these thresholds.

### Writing a test

```typescript
import { describe, it, expect } from 'vitest';
import { can, PERMISSIONS } from '../roles';

describe('can()', () => {
  it('super_admin has every permission', () => {
    for (const p of Object.values(PERMISSIONS)) {
      expect(can('super_admin', p)).toBe(true);
    }
  });

  it('CRITICAL: admin cannot assign super_admin', () => {
    expect(canAssignRole('admin', 'super_admin')).toBe(false);
  });
});
```

Prefix tests that guard against privilege escalation or security invariants with `CRITICAL:` — this makes them easy to find in CI output and communicates their importance.

---

## 19. File & import conventions

### Path aliases

Always use `@/` for absolute imports. Never use relative paths that traverse more than one directory level:

```typescript
// ✓ Correct
import { env } from '@/lib/env';
import { Button } from '@/components/ui';
import { requirePermission } from '@/lib/auth/guard';

// ✓ Acceptable — same directory or one level
import styles from './Button.module.css';
import { ChangePasswordForm } from './ChangePasswordForm';

// ✗ Wrong
import { env } from '../../lib/env';
import { Button } from '../../../components/ui/Button';
```

### Barrel exports

Import from barrels, not individual files:

```typescript
// ✓ Correct
import { Button, Alert, Card } from '@/components/ui';
import { useApiQuery, useApiMutation } from '@/lib/hooks';

// ✗ Wrong
import { Button } from '@/components/ui/Button';
import { useApiQuery } from '@/lib/hooks/useApiQuery';
```

### File naming

```
PascalCase.tsx       React components
camelCase.ts         Library modules, hooks, utilities
kebab-case.sql       SQL migrations (prefixed with sequence number)
UPPER_CASE.md        Documentation files (README.md, AGENTS.md)
```

### Server-only modules

Files that must never run in the browser have `import 'server-only';` as their first import. This causes a build-time error if accidentally imported client-side:

```typescript
// lib/supabase/admin.ts
import 'server-only';
// ...
```

Files that are server-only: `lib/supabase/admin.ts`, `lib/supabase/server.ts`, `lib/env.ts`, `lib/logger.ts`, `lib/auth/audit.ts`, `lib/auth/rate-limit.ts`, `lib/storage/upload.ts`, all Route Handlers.

### 'use client' directive

Only add `'use client'` when a component actually needs browser APIs (`useState`, `useEffect`, event handlers, `window`, `document`, portals). Server Components are the default and are preferred — they render on the server with full access to secrets and the database.

---

## 20. What never to do

These are hard rules. No exceptions.

### Security

- **Never store the raw invite token.** Only the SHA-256 hash goes in the database. The raw token appears in the setup URL once and is never stored.
- **Never let a non-super_admin promote anyone to super_admin.** Check with `canAssignRole()`, enforced also by RLS.
- **Never trust a client-supplied org ID.** Resolve `orgId` from `env.defaultOrgId` (single-tenant) or from a trusted server-side source (subdomain, domain mapping). Never read it from the request body.
- **Never expose the service role key to the client.** The module has `import 'server-only'`. Do not remove it.
- **Never call `auth.getUser()` in middleware without also refreshing the session.** Use `createSupabaseServerClient()` which handles the refresh automatically.
- **Never skip the audit log for privileged actions.** Every invite, suspend, role change, and config edit must produce an audit row.

### Code quality

- **Never write inline styles** except in the three documented exceptions (§5).
- **Never use `console.*`** in production paths (§15).
- **Never access `process.env` directly** — use `lib/env.ts` (§14).
- **Never edit an applied migration** — always write a new one (§10).
- **Never add a page without a corresponding `loading.tsx`** — every route that does async work needs a skeleton.
- **Never leave a new table without RLS policies.** Enable RLS immediately in the same migration that creates the table.
- **Never add new shared components without exporting from the barrel.** Add to `components/ui/index.ts` immediately.
- **Never use `window.confirm()`** — use `<ConfirmDialog>`.
- **Never duplicate the card/panel/success-box/error-box pattern** — use `<Card>` and `<Alert>`.
- **Never use raw `<select>` elements** — use `<Select>`.

### Architecture

- **Never add business logic to components.** Components render. Business logic lives in `lib/`.
- **Never add database queries to client components.** Data flows server → client via props or API routes.
- **Never put API secrets in `NEXT_PUBLIC_*` variables.** They will be bundled into the client JS.
- **Never add new dependencies without evaluating** whether a native API or existing package covers the use case.

---

## Quick reference — most common tasks

### Add a new admin page

1. Create `app/(admin)/admin/my-feature/page.tsx` (Server Component)
2. Add `app/(admin)/admin/my-feature/loading.tsx` with Skeleton content
3. Create `app/(admin)/admin/my-feature/my-feature.module.css`
4. Wrap content in `<PageShell title="...">` and `<Card>`
5. Add auth guard: `if (!can(profile.role, PERMISSIONS.MY_PERM)) redirect('/dashboard');`
6. Add a nav link in `components/layout/AdminSidebar.tsx`

### Add a new API route

1. Create `app/api/[scope]/[resource]/route.ts`
2. Follow the standard structure: extract context → rate limit → parse body → guard → logic → audit → respond
3. Use response helpers from `lib/api/response.ts`
4. Add Zod schema to `lib/validation/schemas.ts`

### Add a new database table

1. Write `supabase/migrations/000N_add_table_name.sql`
2. Include `alter table ... enable row level security` in the same file
3. Add RLS policies (see §11)
4. Run `npm run db:reset` locally
5. Run `npm run db:types` and commit `types/database.ts`
6. If the table needs audit events, add actions to `lib/auth/audit.ts`

### Add a new permission

1. Add to `PERMISSIONS` in `lib/auth/roles.ts`
2. Add to the appropriate role's array in `ROLE_PERMISSIONS`
3. Add to `PERMISSION_GROUPS` in `app/(admin)/admin/roles/page.tsx`
4. Add an RLS policy that enforces the same rule at the database level
5. Add a test in `lib/auth/__tests__/roles.test.ts`

### Add a new UI component

1. Create `components/ui/MyComponent.tsx` and `components/ui/MyComponent.module.css`
2. Use only design tokens in CSS — no hardcoded values
3. Accept `className?: string` prop
4. Export from `components/ui/index.ts`
5. Add a JSDoc comment explaining when to use it
