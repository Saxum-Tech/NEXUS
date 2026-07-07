/**
 * lib/auth/__tests__/synthetic-email.test.ts
 * ─────────────────────────────────────────────────────────────
 * This module is the crux of the whole "username login, no real
 * email, duplicates allowed" requirement. Bugs here mean either
 * users can't log in, or two orgs' usernames collide and one
 * account locks another out. Test it thoroughly.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  buildSyntheticEmail,
  parseSyntheticEmail,
  isValidUsername,
  normaliseUsername,
  resolveLoginEmail,
  assertValidUsername,
  InvalidUsernameError,
} from '../synthetic-email';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-000000000002';

describe('isValidUsername', () => {
  it.each([
    ['jane.doe', true],
    ['john-smith-2', true],
    ['abc12', true],
    ['ab', false], // below 5-char floor enforced by the regex's {2,38} middle section + 2 bookend chars
    ['Jane.Doe', false], // uppercase not allowed
    ['jane doe', false], // space not allowed
    ['jane@doe', false], // @ not allowed
    ['.janedoe', false], // cannot start with a dot
    ['janedoe.', false], // cannot end with a dot
    ['-janedoe', false], // cannot start with a hyphen
    ['janedoe-', false], // cannot end with a hyphen
    ['a'.repeat(40), true], // exactly at the max length boundary
    ['a'.repeat(41), false], // one over the max length boundary
  ])('isValidUsername(%s) === %s', (input: string, expected: boolean) => {
    expect(isValidUsername(input)).toBe(expected);
  });
});

describe('normaliseUsername', () => {
  it('trims whitespace and lowercases', () => {
    expect(normaliseUsername('  Jane.DOE  ')).toBe('jane.doe');
  });
});

describe('assertValidUsername', () => {
  it('does not throw for a valid username', () => {
    expect(() => assertValidUsername('jane.doe')).not.toThrow();
  });

  it('throws InvalidUsernameError for an invalid username', () => {
    expect(() => assertValidUsername('Jane Doe')).toThrow(InvalidUsernameError);
  });
});

describe('buildSyntheticEmail', () => {
  it('builds the expected {username}__{orgId}@internal.invalid format', () => {
    expect(buildSyntheticEmail('jane.doe', ORG_A)).toBe(
      `jane.doe__${ORG_A}@internal.invalid`
    );
  });

  it('normalises the username before building (case/whitespace insensitive)', () => {
    expect(buildSyntheticEmail('  Jane.Doe  ', ORG_A)).toBe(
      buildSyntheticEmail('jane.doe', ORG_A)
    );
  });

  it('throws on an invalid username rather than silently producing a bad address', () => {
    expect(() => buildSyntheticEmail('Jane Doe', ORG_A)).toThrow(InvalidUsernameError);
  });

  it('throws if orgId looks malformed (defensive check)', () => {
    expect(() => buildSyntheticEmail('jane.doe', 'x')).toThrow();
  });

  it('CRITICAL: the same username in two different orgs produces two distinct addresses', () => {
    const emailA = buildSyntheticEmail('jane.doe', ORG_A);
    const emailB = buildSyntheticEmail('jane.doe', ORG_B);
    expect(emailA).not.toBe(emailB);
  });
});

describe('parseSyntheticEmail', () => {
  it('round-trips a well-formed synthetic email back to {username, orgId}', () => {
    const email = buildSyntheticEmail('jane.doe', ORG_A);
    const parsed = parseSyntheticEmail(email);
    expect(parsed).toEqual({ username: 'jane.doe', orgId: ORG_A });
  });

  it('returns null for a non-synthetic (real-looking) email', () => {
    expect(parseSyntheticEmail('person@gmail.com')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseSyntheticEmail('not-an-email-at-all')).toBeNull();
  });

  it('returns null if the embedded username segment is invalid', () => {
    // Malformed on purpose: uppercase in the username portion.
    expect(parseSyntheticEmail(`Jane.Doe__${ORG_A}@internal.invalid`)).toBeNull();
  });
});

describe('resolveLoginEmail', () => {
  it('produces exactly the same address that account creation would have produced', () => {
    expect(resolveLoginEmail('jane.doe', ORG_A)).toBe(buildSyntheticEmail('jane.doe', ORG_A));
  });

  it('is case-insensitive at login time, matching normalisation at creation time', () => {
    expect(resolveLoginEmail('JANE.DOE', ORG_A)).toBe(buildSyntheticEmail('jane.doe', ORG_A));
  });
});
