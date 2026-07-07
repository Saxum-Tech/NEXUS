# Enterprise App Template

A reusable foundation for internal/enterprise web applications.
Clone it, add your product screens, ship.

---

## What's included

### Authentication
- **Username + password login** — no email addresses used for auth
- **Synthetic email system** — Supabase requires an email field internally; a non-deliverable `{username}__{org_id}@internal.invalid` address is generated automatically. Users never see it
- **Duplicate contact emails supported** — multiple users can share a real-world email (e.g. a shared inbox)
- **Invite-only** — no public sign-up. Every account is created by an admin via the invite flow
- **Session timeout** — configurable inactivity timeout enforced in middleware without a DB query per request
- **Concurrent session limiting** — optionally revoke all prior sessions on new login
- **Rate limiting** — sliding-window rate limiter on login (10/min) and set-password (5/15min) routes to block brute-force attacks
- **Password complexity** — configurable per-org, enforced server-side at both invite acceptance and self-service change

### Authorisation
- **Four built-in roles** — `super_admin`, `admin`, `editor`, `viewer`
- **Permission matrix** — defined in `lib/auth/roles.ts`, the single source of truth
- **Enforced twice** — application-layer `requirePermission()` guard in every Route Handler, plus Postgres Row-Level Security policies that deny at the database level regardless of application bugs
- **Privilege escalation prevention** — admins cannot create or promote users to `super_admin`; admins cannot act on peers or higher-ranked users

### Admin panel
- User list with search, pagination, role/status badges
- Invite user flow with setup-link delivery
- Suspend / reinstate / reset-password actions with `ConfirmDialog` (no browser `confirm()`)
- Roles & permissions read-only matrix (sourced directly from `lib/auth/roles.ts` — never a copy that can drift)
- App settings — name, branding colour, logo/favicon upload (to Supabase Storage), security policy toggles
- Audit log — append-only, paginated, readable by admin and above
- Admin overview with live user counts

### Dynamic branding
- `app_config` table per org — `app_name`, `primary_color`, `icon_letter`, `logo_url`, `favicon_url`
- Brand colour injected as `--color-brand` CSS variable server-side in the root layout — zero flash on first paint
- Logo and favicon uploaded to Supabase Storage via `POST /api/admin/upload`
- All 14 UI components and every page inherit the brand colour automatically through the token

### Developer experience
- **Structured logger** (`lib/logger.ts`) — JSON to stdout in dev, swap `emit()` for Datadog/Axiom/Pino in prod
- **API response helpers** (`lib/api/response.ts`) — `ok()`, `created()`, `badRequest()`, `validationError()`, `forbidden()`, `notFound()`, `serverError()`, `tooManyRequests()` — consistent error shape across all 13 Route Handlers
- **Environment validation** (`lib/env.ts`) — one place to require env vars; missing ones throw clearly at startup
- **Health check** (`GET /api/health`) — checks DB connectivity, returns latency, used by load balancers and uptime monitors
- **Error boundaries** — `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
- **Loading skeletons** — `loading.tsx` for every major route using the shared `Skeleton` component
- **ESLint + Prettier** — configured, integrated into `npm run check`
- **CI/CD** — GitHub Actions workflow running typecheck, lint, test, and build in parallel
- **Supabase CLI config** — `supabase/config.toml` for local dev with `npx supabase start`

### Shared UI components (`components/ui/`)
`Alert` · `Avatar` · `Badge` · `Button` · `Card` · `ConfirmDialog` · `EmptyState` · `MetricCard` · `Pagination` / `LinkPagination` · `Skeleton` · `Spinner` · `TextField` · `Toast` · `UploadZone`

All imported from the barrel: `import { Button, Alert, Badge } from '@/components/ui'`

### Layout components (`components/layout/`)
`PageShell` · `AdminSidebar` · `AdminSidebarClient`

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database / Auth | Supabase (Postgres + Row-Level Security) |
| Validation | Zod |
| Testing | Vitest |
| Styling | CSS Modules + design tokens |
| CI | GitHub Actions |

---

## Project structure

```
app/
  login/                    Username/password login page
  set-password/             Invite acceptance + password reset
  error.tsx                 Error boundary
  global-error.tsx          Root-level error boundary
  not-found.tsx             404 page
  (app)/                    Authenticated user routes
    dashboard/
    profile/
  (admin)/                  Admin-only routes (ADMIN_PANEL_ACCESS required)
    admin/
      page.tsx              Overview
      users/                List, invite
      roles/                Permission matrix (read-only)
      settings/             Branding, security config
      audit/                Audit log
  api/
    health/                 GET — load balancer health check
    auth/
      login/                POST — username→synthetic email sign-in
      logout/               POST — sign out + audit event
      set-password/         POST — invite acceptance / password reset
      change-password/      POST — self-service password change
    admin/
      upload/               POST — logo / favicon to Supabase Storage
      config/               GET / PATCH — app_config
      users/                GET — paginated list with search
      users/invite/         POST — create account + send setup link
      users/[id]/
        suspend/            POST
        reinstate/          POST
        reset-password/     POST
        role/               PATCH

lib/
  api/response.ts           Route Handler response helpers
  auth/
    roles.ts                Permission matrix + role helpers
    synthetic-email.ts      Username ↔ synthetic email conversion
    session.ts              Resolve current request's profile
    guard.ts                requirePermission() for Route Handlers
    invite.ts               Setup-link token generation/verification
    audit.ts                writeAuditEvent()
    rate-limit.ts           Sliding-window in-memory rate limiter
  supabase/
    server.ts               RLS-bound client (per-request session)
    admin.ts                Service-role client (bypasses RLS)
  validation/schemas.ts     Zod schemas for every API request body
  email/send-invite-email.ts Email delivery (console log until configured)
  storage/upload.ts         Supabase Storage helper for branding assets
  config/get-app-config.ts  Fetch org config server-side for SSR
  env.ts                    Validated environment variable access
  logger.ts                 Structured JSON logger

supabase/migrations/
  0001_init_schema.sql      organisations, profiles, app_config, audit_log, invite_tokens
  0002_rls_policies.sql     All Row-Level Security policies
  0003_seed_dev_data.sql    Local dev seed (default org + config)
  0004_storage_buckets.sql  Branding storage bucket + RLS

components/
  ui/                       14 shared components + barrel export (index.ts)
  layout/                   PageShell, AdminSidebar, AdminSidebarClient

scripts/
  seed-admin.ts             Bootstrap the first super_admin account
```

---

## Setup

### 1. Create a Supabase project

[supabase.com](https://supabase.com) → New project.
Copy the **Project URL**, **anon key**, and **service role key** from
Settings → API.

### 2. Configure environment variables

```bash
cp .env.example .env.local
# fill in the values
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run migrations

```bash
# Against the hosted project:
npm run db:migrate

# Or locally with the Supabase CLI:
npm run db:start   # starts local Postgres, Auth, Studio
npm run db:reset   # applies all migrations + seed data fresh
```

### 5. Create the first admin account

No UI exists for the very first user — the invite flow requires an
existing admin. Bootstrap with:

```bash
npm run seed:admin -- --username admin --password 'Replace-This-1!'
```

### 6. Run

```bash
npm run dev
# → http://localhost:3000
```

Sign in at `/login` with the credentials from step 5. From
`/admin/users/invite` you can now invite all other users.

---

## Developer workflow

```bash
npm run check          # typecheck + lint + format check + tests (run before every PR)
npm run lint:fix       # auto-fix lint issues
npm run format         # auto-format with Prettier
npm run test:watch     # tests in watch mode
npm run test:coverage  # coverage report (html in coverage/)
npm run db:studio      # open Supabase Studio for local DB
npm run db:types       # regenerate types/database.ts from live schema
```

---

## Wiring up email delivery

`lib/email/send-invite-email.ts` logs setup links to the server console
by default — usable in development, not for real users. To send real
emails, uncomment one of the two examples in that file (Resend or AWS
SES), install the SDK, and add the matching env vars from `.env.example`.

---

## Extending roles

Roles live in code (`lib/auth/roles.ts`) — not in a database table — so
changes go through code review and are covered by the test suite. The
`/admin/roles` page reads and displays this matrix but cannot edit it.

If your product needs admin-configurable custom roles beyond the four
built-ins, see the note at the bottom of `app/(admin)/admin/roles/page.tsx`
for the full schema change that would involve.

---

## Security model

| Layer | What it enforces |
|---|---|
| `requirePermission()` in Route Handlers | Fast 403s; prevents application-layer bugs from reaching the DB |
| Postgres RLS (`0002_rls_policies.sql`) | Real enforcement — the DB denies queries regardless of application code |
| `canAssignRole()` / `canActOnUser()` | Privilege escalation prevention (admin → super_admin blocked) |
| Rate limiting (`lib/auth/rate-limit.ts`) | Brute-force protection on login and setup-link endpoints |
| Invite tokens (SHA-256 hashed, 24h TTL) | Raw token never stored; can't be forged from a DB leak |
| Audit log (`public.audit_log`) | Append-only; no UPDATE/DELETE policy exists for any role |

---

## Honest status of this codebase

Built in an environment with no npm registry access, so `npm install`
was never run against real packages here. Compensations made:

- `tsc --noEmit` run after every change. Genuine bugs (broken discriminated
  unions, wrong import paths, JSX structural errors) were found and fixed.
- The three pure-logic modules (`synthetic-email.ts`, `roles.ts`,
  `rate-limit.ts`) were **executed** against real assertions in this
  environment — 23 tests, all passing, against the actual shipped files.
- Framework glue code (Route Handlers, middleware, components) was
  verified by careful manual review against each library's documented API.

**Before treating this as production-ready:**
1. `npm install` and `npm run check` — resolve any remaining type errors
2. `npm run db:reset` against a real Supabase project
3. Walk the invite → set-password → login flow end-to-end
4. Wire `lib/email/send-invite-email.ts` to a real provider before inviting real users
