# Microsoft Graph Foundation

Microsoft Graph is the primary integration layer between NEXUS and Microsoft 365.

NEXUS must treat Graph as a controlled server-side capability, not as a generic client-side API. Every Graph action must pass through authentication, tenant resolution, permission checks, and audit logging.

## Initial scope

The initial Graph scope is intentionally conservative:

- sign in the user through Microsoft Entra ID;
- identify the Microsoft tenant;
- map the Microsoft user to the NEXUS organisation/profile model;
- read the selected Outlook message context where permitted;
- prepare the structure for future mail, calendar, contact, Teams, SharePoint, and directory integrations.

## Core principles

1. Request least-privilege scopes only.
2. Keep secrets server-side.
3. Store tenant and consent metadata, not uncontrolled mailbox data.
4. Do not introduce application-wide mailbox access until a specific enterprise feature requires it.
5. Log every consent, token refresh failure, Graph action, and privileged Microsoft operation.
6. Keep Microsoft tenant ID separate from the internal organisation ID.

## Database foundation

The first Microsoft database milestone is `supabase/migrations/0005_microsoft_identity_schema.sql`.

It introduces:

- `microsoft_tenants` — maps a NEXUS organisation to one Microsoft Entra tenant for the MVP;
- `microsoft_user_links` — maps a NEXUS profile to the Microsoft user object used by Graph;
- `microsoft_consent_grants` — records delegated/application consent metadata and scopes;
- `microsoft_graph_activity` — append-only technical telemetry for Graph calls.

The internal NEXUS tenant boundary remains `public.organisations.id`. The Microsoft tenant id from Entra ID remains external metadata and must never replace NEXUS organisation scoping.

The Microsoft tables are intentionally read-only from normal browser sessions. Writes must go through trusted Route Handlers using the Supabase service-role client after `requirePermission()` checks and audit logging.

## Recommended service modules

```text
lib/microsoft/
  config.ts
  tenant.ts
  permissions.ts

lib/graph/
  client.ts
  auth.ts
  mail.ts
  users.ts
  calendar.ts
  contacts.ts
  teams.ts
  sharepoint.ts
```

## Minimum environment variables

```text
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=
MICROSOFT_POST_LOGOUT_REDIRECT_URI=
MICROSOFT_GRAPH_SCOPES=openid profile email offline_access User.Read Mail.Read
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=
NEXT_PUBLIC_OUTLOOK_ADDIN_ENABLED=false
```

## Dependency plan

Add these packages when implementation begins:

```bash
npm install @azure/msal-browser @azure/msal-react @microsoft/microsoft-graph-client @microsoft/office-js
```

The package update should be done in a dedicated implementation PR after local install and lockfile verification.

## First implementation milestone

The first Microsoft milestone is successful sign-in and tenant mapping. Do not start mail automation until login, tenant isolation, consent recording, and audit logging are complete.
