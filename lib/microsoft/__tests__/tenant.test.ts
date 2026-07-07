import { describe, expect, it } from 'vitest';

import {
  checkMicrosoftTenantCompatibility,
  parseMicrosoftIdentityClaims,
} from '../tenant';

describe('parseMicrosoftIdentityClaims', () => {
  it('extracts Microsoft tenant, user, username, mail, and display name claims', () => {
    expect(
      parseMicrosoftIdentityClaims({
        tid: 'tenant-123',
        oid: 'user-456',
        preferred_username: 'alex@example.com',
        email: 'alex@example.com',
        name: 'Alex Example',
      })
    ).toEqual({
      entraTenantId: 'tenant-123',
      entraUserId: 'user-456',
      userPrincipalName: 'alex@example.com',
      mail: 'alex@example.com',
      displayName: 'Alex Example',
    });
  });

  it('falls back to upn then email when preferred_username is absent', () => {
    expect(
      parseMicrosoftIdentityClaims({
        tid: 'tenant-123',
        oid: 'user-456',
        upn: 'operations@example.com',
      }).userPrincipalName
    ).toBe('operations@example.com');

    expect(
      parseMicrosoftIdentityClaims({
        tid: 'tenant-123',
        oid: 'user-456',
        email: 'shared@example.com',
      }).userPrincipalName
    ).toBe('shared@example.com');
  });

  it('rejects tokens without the Microsoft tenant id claim', () => {
    expect(() =>
      parseMicrosoftIdentityClaims({ oid: 'user-456', preferred_username: 'alex@example.com' })
    ).toThrow('tid');
  });

  it('rejects tokens without the Microsoft user object id claim', () => {
    expect(() =>
      parseMicrosoftIdentityClaims({ tid: 'tenant-123', preferred_username: 'alex@example.com' })
    ).toThrow('oid');
  });
});

describe('checkMicrosoftTenantCompatibility', () => {
  it('allows dynamic enterprise tenant modes', () => {
    expect(checkMicrosoftTenantCompatibility('tenant-123', 'common')).toEqual({
      ok: true,
      dynamicTenantMode: true,
    });

    expect(checkMicrosoftTenantCompatibility('tenant-123', 'organizations')).toEqual({
      ok: true,
      dynamicTenantMode: true,
    });
  });

  it('allows exact configured tenant matches', () => {
    expect(checkMicrosoftTenantCompatibility('TENANT-123', 'tenant-123')).toEqual({
      ok: true,
      dynamicTenantMode: false,
    });
  });

  it('rejects mismatched fixed tenants', () => {
    expect(checkMicrosoftTenantCompatibility('tenant-123', 'tenant-999')).toEqual({
      ok: false,
      reason: 'Microsoft token tenant does not match the configured tenant id.',
    });
  });

  it('rejects personal Microsoft account mode', () => {
    expect(checkMicrosoftTenantCompatibility('tenant-123', 'consumers')).toEqual({
      ok: false,
      reason: 'Personal Microsoft accounts are not supported for NEXUS enterprise sign-in.',
    });
  });
});
