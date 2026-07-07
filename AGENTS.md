# NEXUS Engineering Guide

Read this file before making changes in this repository.

NEXUS is an enterprise Microsoft 365 and Outlook companion platform. The codebase must remain secure, typed, auditable, and easy to extend.

## Required workflow

- Work through feature branches and pull requests only.
- Keep each pull request focused on one milestone.
- Update documentation when architecture, schema, Microsoft permissions, or user flows change.
- Run `npm run check` before marking implementation work ready.
- Keep commits small enough to review.

## Code standards

- Use TypeScript strictly.
- Prefer small typed modules over large mixed-purpose files.
- Keep business logic out of UI components.
- Use shared UI components before creating new ones.
- Use Zod for request validation.
- Keep server-only code out of client components.
- Do not silence TypeScript, lint, or tests to hide issues.

## Data and security

- Scope company-owned data to the organisation boundary.
- Add database policies for new company-owned tables.
- Add audit logs for important administrative and business actions.
- Keep service-role access behind narrow server-side helpers.
- Never expose secrets in public variables or browser code.

## Microsoft integration

- Microsoft Graph calls must go through approved Graph service modules.
- New Graph scopes must be documented before use.
- Outlook task pane work must account for pinned panes and message changes.
- Do not assume one task pane page load equals one email.

## Assisted development rules

Automated contributors may classify, summarize, draft, and recommend changes, but deterministic application rules must enforce approvals, routing, permissions, and escalation.

Generated responses and workflows must be grounded in approved company data when company facts are involved.

## Pull request checklist

Each pull request should describe:

- what changed;
- why it changed;
- affected modules;
- database impact;
- Microsoft Graph scope impact;
- security impact;
- verification notes;
- follow-up work.
