/**
 * lib/auth/synthetic-email.ts
 * ─────────────────────────────────────────────────────────────
 * Supabase Auth requires every user to have an `email` column
 * value (it's the primary identity field internally, even when
 * email/password sign-in is disabled in your product). Since
 * this app authenticates by USERNAME and must support duplicate
 * real email addresses across users, we generate a synthetic,
 * non-deliverable address per user and use that internally:
 *
 *     {username}__{org_id}@internal.invalid
 *
 * Why these specific choices:
 *   • `internal.invalid` is a reserved TLD per RFC 2606 — it is
 *     guaranteed to never resolve, so even if this address leaked
 *     it cannot deliver mail or be registered by someone else.
 *   • Double underscore separator avoids collisions with valid
 *     username characters (dots and single hyphens are allowed
 *     in usernames; `__` is not).
 *   • org_id (not org slug) is embedded so the address is stable
 *     even if the organisation is renamed later.
 *
 * This module is the ONLY place that should construct or parse
 * these addresses. If you ever need to change the format, change
 * it here and nowhere else.
 * ─────────────────────────────────────────────────────────────
 */

const SYNTHETIC_EMAIL_DOMAIN = 'internal.invalid';
const SEPARATOR = '__';

/**
 * Username rules, mirrored in the DB CHECK constraint
 * (see migration 0001, `username_format`). Keep these two
 * definitions in sync.
 *
 *   • lowercase a-z, 0-9, dot, hyphen
 *   • 5–40 characters total
 *   • must start and end with an alphanumeric character
 */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9.\-]{2,38}[a-z0-9]$/;

export class InvalidUsernameError extends Error {
  constructor(username: string) {
    super(
      `"${username}" is not a valid username. Use 5-40 lowercase letters, numbers, dots or hyphens, and don't start or end with a dot/hyphen.`
    );
    this.name = 'InvalidUsernameError';
  }
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function assertValidUsername(username: string): void {
  if (!isValidUsername(username)) {
    throw new InvalidUsernameError(username);
  }
}

/** Normalises user input before validation/storage (trim + lowercase). */
export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Builds the synthetic auth email for a given username + org.
 * Throws if the username is invalid — callers should validate
 * with a friendlier error first (this is a defensive last line).
 */
export function buildSyntheticEmail(username: string, orgId: string): string {
  const normalised = normaliseUsername(username);
  assertValidUsername(normalised);

  if (!orgId || orgId.length < 8) {
    throw new Error('buildSyntheticEmail: orgId looks invalid');
  }

  return `${normalised}${SEPARATOR}${orgId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Parses a synthetic email back into { username, orgId }.
 * Returns null if the address doesn't match our format — useful
 * for defensively handling any legacy/real email rows during a
 * migration from a different auth system.
 */
export function parseSyntheticEmail(
  email: string
): { username: string; orgId: string } | null {
  const domainSuffix = `@${SYNTHETIC_EMAIL_DOMAIN}`;
  if (!email.endsWith(domainSuffix)) return null;

  const localPart = email.slice(0, -domainSuffix.length);
  const sepIndex = localPart.lastIndexOf(SEPARATOR);
  if (sepIndex === -1) return null;

  const username = localPart.slice(0, sepIndex);
  const orgId = localPart.slice(sepIndex + SEPARATOR.length);

  if (!isValidUsername(username) || orgId.length < 8) return null;

  return { username, orgId };
}

/**
 * Given a "username" the user typed at the login screen plus the
 * org they're logging into, resolves the exact synthetic email
 * to hand to supabase.auth.signInWithPassword(). This is a pure
 * string-building convenience wrapper kept separate from
 * buildSyntheticEmail so call sites read clearly at the login
 * call site vs. the user-creation call site.
 */
export function resolveLoginEmail(username: string, orgId: string): string {
  return buildSyntheticEmail(normaliseUsername(username), orgId);
}
