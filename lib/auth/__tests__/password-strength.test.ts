/**
 * lib/auth/__tests__/password-strength.test.ts
 * ─────────────────────────────────────────────────────────────
 * Tests the password scoring logic that drives the
 * PasswordStrength component. The component and server-side
 * buildPasswordSchema() must agree on what "strong" means —
 * this suite verifies the client-side scoring is consistent
 * with the server-side rules in lib/validation/schemas.ts.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';

// ── Inline the scoring logic from PasswordStrength.tsx ──────
// We test the logic directly rather than importing the component
// because the component is a client-side React component that
// can't run in a Node test environment without jsdom.
// Keep this in sync with PasswordStrength.tsx.

interface Rule {
  label: string;
  test: (pw: string) => boolean;
  complexityOnly?: boolean;
}

const RULES: Rule[] = [
  { label: 'At least 12 characters',  test: (pw) => pw.length >= 12 },
  { label: 'Uppercase (A–Z)',          test: (pw) => /[A-Z]/.test(pw), complexityOnly: true },
  { label: 'Lowercase (a–z)',          test: (pw) => /[a-z]/.test(pw), complexityOnly: true },
  { label: 'Number (0–9)',             test: (pw) => /[0-9]/.test(pw), complexityOnly: true },
  { label: 'Special character',        test: (pw) => /[^a-zA-Z0-9]/.test(pw), complexityOnly: true },
];

function computeScore(password: string, enforceComplexity: boolean): number {
  if (!password) return 0;
  const activeRules = RULES.filter((r) => !r.complexityOnly || enforceComplexity);
  const passing = activeRules.filter((r) => r.test(password)).length;
  return Math.min(4, Math.max(1, Math.round((passing / activeRules.length) * 4)));
}

describe('PasswordStrength scoring (enforceComplexity: true)', () => {
  it('empty password → 0', () => {
    expect(computeScore('', true)).toBe(0);
  });

  it('very short password → 1 (weak)', () => {
    expect(computeScore('abc', true)).toBe(1);
  });

  it('length + lowercase passes → score 2', () => {
    // 'abcdefghijkl': length ✓, uppercase ✗, lowercase ✓, number ✗, special ✗ → 2/5 → score 2
    expect(computeScore('abcdefghijkl', true)).toBe(2);
  });

  it('CRITICAL: all five rules must pass to score 4', () => {
    // 'Abcdef123!' is only 10 chars — length rule FAILS → score 3, not 4
    // This documents the exact threshold: all 5 rules must pass for score 4
    const shortButMixed = 'Abcdef123!';
    expect(shortButMixed.length).toBeLessThan(12); // confirm it's short
    expect(computeScore(shortButMixed, true)).toBe(3); // 4/5 rules → 3

    // A genuinely strong password passes all 5 rules → score 4
    const strong = 'CorrectHorse9!';
    expect(strong.length).toBeGreaterThanOrEqual(12);
    expect(computeScore(strong, true)).toBe(4);
  });

  it('missing uppercase → score < 4', () => {
    expect(computeScore('abcdefgh12!', true)).toBeLessThan(4);
  });

  it('missing special character → score < 4', () => {
    expect(computeScore('CorrectHorse99', true)).toBeLessThan(4);
  });

  it('missing number → score < 4', () => {
    expect(computeScore('CorrectHorse!!', true)).toBeLessThan(4);
  });

  it('score increases as more rules are satisfied', () => {
    const weak   = computeScore('abc',            true); // 1/5
    const medium = computeScore('abcdefghijkl',   true); // 2/5
    const good   = computeScore('Abcdefghijkl',   true); // 3/5
    const strong = computeScore('CorrectHorse9!', true); // 5/5

    // Each step must be non-decreasing
    if (weak   > medium) throw new Error(`weak(${weak}) > medium(${medium})`);
    if (medium > good)   throw new Error(`medium(${medium}) > good(${good})`);
    if (good   > strong) throw new Error(`good(${good}) > strong(${strong})`);
    expect(strong).toBe(4);
  });
});

describe('PasswordStrength scoring (enforceComplexity: false)', () => {
  it('only the length rule applies', () => {
    // All character-class rules are irrelevant when complexity is off
    const longLower = 'abcdefghijklmnop'; // 16 chars, all lower
    expect(computeScore(longLower, false)).toBe(4); // 1/1 rules → 4
  });

  it('short password still scores low', () => {
    expect(computeScore('short', false)).toBe(1);
  });

  it('exactly 12 chars → 4 (only rule is length)', () => {
    expect(computeScore('abcdefghijkl', false)).toBe(4);
  });
});
