import { describe, expect, it } from 'vitest';

import {
  forbiddenInitialGraphScopes,
  graphScopesToString,
  hasGraphScope,
  missingRequiredGraphScopes,
  normalizeGraphScopes,
  validateInitialGraphScopes,
} from '../permissions';

describe('normalizeGraphScopes', () => {
  it('accepts space and comma separated scope input', () => {
    expect(normalizeGraphScopes('openid profile,email offline_access')).toEqual([
      'openid',
      'profile',
      'email',
      'offline_access',
    ]);
  });

  it('deduplicates scopes case-insensitively while preserving first casing', () => {
    expect(normalizeGraphScopes(['User.Read', 'user.read', 'Mail.Read'])).toEqual([
      'User.Read',
      'Mail.Read',
    ]);
  });
});

describe('hasGraphScope', () => {
  it('matches scopes case-insensitively', () => {
    expect(hasGraphScope(['User.Read'], 'user.read')).toBe(true);
  });
});

describe('missingRequiredGraphScopes', () => {
  it('returns only the required scopes that are not present', () => {
    expect(missingRequiredGraphScopes(['openid', 'profile', 'email'])).toEqual([
      'offline_access',
      'User.Read',
      'Mail.Read',
    ]);
  });
});

describe('forbiddenInitialGraphScopes', () => {
  it('flags high-risk scopes that should not be part of the initial delegated login', () => {
    expect(forbiddenInitialGraphScopes(['User.Read', 'Mail.Send', 'Mail.ReadWrite'])).toEqual([
      'Mail.Send',
      'Mail.ReadWrite',
    ]);
  });

  it('flags default application permission expansion scopes', () => {
    expect(forbiddenInitialGraphScopes(['https://graph.microsoft.com/.default'])).toEqual([
      'https://graph.microsoft.com/.default',
    ]);
  });
});

describe('validateInitialGraphScopes', () => {
  it('accepts the conservative MVP scope set', () => {
    const result = validateInitialGraphScopes(
      'openid profile email offline_access User.Read Mail.Read'
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.forbidden).toEqual([]);
  });

  it('rejects missing and forbidden scopes together', () => {
    const result = validateInitialGraphScopes('openid profile Mail.Send');

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['email', 'offline_access', 'User.Read', 'Mail.Read']);
    expect(result.forbidden).toEqual(['Mail.Send']);
  });
});

describe('graphScopesToString', () => {
  it('outputs a normalized Microsoft scope string', () => {
    expect(graphScopesToString(['openid', 'openid', 'User.Read'])).toBe('openid User.Read');
  });
});
