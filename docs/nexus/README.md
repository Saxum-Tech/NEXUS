# NEXUS Foundation

NEXUS is an enterprise Microsoft 365 and Outlook companion platform.

Its purpose is to give companies a governed operational layer inside Outlook and a browser admin portal for:

- company knowledge and approved procedures;
- approved email templates and snippets;
- directory/contact lookups;
- AI-assisted email summaries and replies;
- escalation detection and handling;
- response-time and user-activity analytics;
- Microsoft Graph integration;
- strict multi-tenant isolation.

## Non-negotiables

1. Every tenant-owned row must be scoped to an organisation/company boundary.
2. Microsoft Graph access must be least-privilege and auditable.
3. Outlook add-in behaviour must support pinned task panes and selected-item changes.
4. AI must never bypass deterministic escalation and permission rules.
5. No direct writes to main. All work must pass through pull requests.
6. All server secrets must stay server-side.
7. Every material business action must be audit logged.

## Initial implementation phases

- Phase 0: Foundation and governance.
- Phase 1: Microsoft identity and Graph connection.
- Phase 2: Outlook add-in shell and pinned task pane support.
- Phase 3: Knowledge, templates, and directory modules.
- Phase 4: AI email intelligence and escalation rules.
- Phase 5: Analytics, approval flows, draft creation, and enterprise hardening.
