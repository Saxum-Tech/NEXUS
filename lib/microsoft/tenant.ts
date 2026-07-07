/**
 * lib/microsoft/tenant.ts
 * ─────────────────────────────────────────────────────────────
 * Pure helpers for parsing Microsoft identity claims and checking
 * whether a token's tenant claim is compatible with the configured
 * Microsoft tenant mode. Database lookups happen in later Route
 * Handlers; this file only validates token-derived identity data.
 * ─────────────────────────────────────────────────────────────
 */

export interface MicrosoftIdentityClaims {
  tid?: unknown;
  oid?: unknown;
  preferred_username?: unknown;
  upn?: unknown;
  email?: unknown;
  name?: unknown;
}

export interface ParsedMicrosoftIdentity {
  entraTenantId: string;
  entraUserId: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string | null;
}

export type TenantCompatibilityResult =
  | { ok: true; dynamicTenantMode: boolean }
  | { ok: false; reason: string };

function readStringClaim(claims: MicrosoftIdentityClaims, key: keyof MicrosoftIdentityClaims): string | null {
  const value = claims[key];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed;
}

export function parseMicrosoftIdentityClaims(
  claims: MicrosoftIdentityClaims
): ParsedMicrosoftIdentity {
  const entraTenantId = readStringClaim(claims, 'tid');
  const entraUserId = readStringClaim(claims, 'oid');
  const preferredUsername = readStringClaim(claims, 'preferred_username');
  const upn = readStringClaim(claims, 'upn');
  const email = readStringClaim(claims, 'email');
  const displayName = readStringClaim(claims, 'name');
  const userPrincipalName = preferredUsername ?? upn ?? email;

  if (!entraTenantId) {
    throw new Error('Microsoft token is missing required tenant claim: tid.');
  }

  if (!entraUserId) {
    throw new Error('Microsoft token is missing required user object claim: oid.');
  }

  if (!userPrincipalName) {
    throw new Error(
      'Microsoft token is missing a usable username claim. Expected preferred_username, upn, or email.'
    );
  }

  return {
    entraTenantId,
    entraUserId,
    userPrincipalName,
    mail: email,
    displayName,
  };
}

export function checkMicrosoftTenantCompatibility(
  tokenTenantId: string,
  configuredTenantId: string
): TenantCompatibilityResult {
  const tokenTenant = tokenTenantId.trim();
  const configuredTenant = configuredTenantId.trim();

  if (!tokenTenant) {
    return { ok: false, reason: 'Token tenant id is blank.' };
  }

  if (!configuredTenant) {
    return { ok: false, reason: 'Configured Microsoft tenant id is blank.' };
  }

  if (configuredTenant === 'consumers') {
    return {
      ok: false,
      reason: 'Personal Microsoft accounts are not supported for NEXUS enterprise sign-in.',
    };
  }

  if (configuredTenant === 'common' || configuredTenant === 'organizations') {
    return { ok: true, dynamicTenantMode: true };
  }

  if (tokenTenant.toLowerCase() !== configuredTenant.toLowerCase()) {
    return {
      ok: false,
      reason: 'Microsoft token tenant does not match the configured tenant id.',
    };
  }

  return { ok: true, dynamicTenantMode: false };
}
