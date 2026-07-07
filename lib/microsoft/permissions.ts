/**
 * lib/microsoft/permissions.ts
 * ─────────────────────────────────────────────────────────────
 * Microsoft Graph scope helpers. These functions are deliberately
 * dependency-free and side-effect-free so Route Handlers, tests,
 * and future setup screens can share one interpretation of the
 * Graph permissions NEXUS expects.
 * ─────────────────────────────────────────────────────────────
 */

export const REQUIRED_DELEGATED_GRAPH_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.Read',
] as const;

export const FORBIDDEN_INITIAL_GRAPH_SCOPES = [
  '.default',
  'Mail.ReadWrite',
  'Mail.Send',
  'MailboxSettings.ReadWrite',
  'Directory.ReadWrite.All',
  'User.ReadWrite.All',
] as const;

export type RequiredDelegatedGraphScope =
  (typeof REQUIRED_DELEGATED_GRAPH_SCOPES)[number];

export interface ScopeValidationResult {
  ok: boolean;
  scopes: string[];
  missing: string[];
  forbidden: string[];
}

function normaliseScopeForComparison(scope: string): string {
  return scope.trim().toLowerCase();
}

function splitScopeInput(input: string): string[] {
  return input
    .split(/[\s,]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function normalizeGraphScopes(input: string | string[]): string[] {
  const rawScopes = Array.isArray(input) ? input : splitScopeInput(input);
  const seen = new Set<string>();
  const scopes: string[] = [];

  for (const rawScope of rawScopes) {
    const scope = rawScope.trim();
    if (!scope) continue;

    const key = normaliseScopeForComparison(scope);
    if (seen.has(key)) continue;

    seen.add(key);
    scopes.push(scope);
  }

  return scopes;
}

export function hasGraphScope(scopes: string[], requiredScope: string): boolean {
  const required = normaliseScopeForComparison(requiredScope);
  return scopes.some((scope) => normaliseScopeForComparison(scope) === required);
}

export function missingRequiredGraphScopes(
  scopes: string[],
  requiredScopes: readonly string[] = REQUIRED_DELEGATED_GRAPH_SCOPES
): string[] {
  return requiredScopes.filter((requiredScope) => !hasGraphScope(scopes, requiredScope));
}

export function forbiddenInitialGraphScopes(scopes: string[]): string[] {
  return scopes.filter((scope) => {
    const comparableScope = normaliseScopeForComparison(scope);
    return FORBIDDEN_INITIAL_GRAPH_SCOPES.some((forbiddenScope) => {
      const comparableForbidden = normaliseScopeForComparison(forbiddenScope);
      return (
        comparableScope === comparableForbidden ||
        comparableScope.endsWith(`/${comparableForbidden}`)
      );
    });
  });
}

export function validateInitialGraphScopes(input: string | string[]): ScopeValidationResult {
  const scopes = normalizeGraphScopes(input);
  const missing = missingRequiredGraphScopes(scopes);
  const forbidden = forbiddenInitialGraphScopes(scopes);

  return {
    ok: missing.length === 0 && forbidden.length === 0,
    scopes,
    missing,
    forbidden,
  };
}

export function graphScopesToString(scopes: string[]): string {
  return normalizeGraphScopes(scopes).join(' ');
}
