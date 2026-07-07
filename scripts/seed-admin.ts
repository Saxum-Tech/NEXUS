/**
 * scripts/seed-admin.ts
 * ─────────────────────────────────────────────────────────────
 * Run once, right after migrations, to create the very first
 * super_admin account. After that, every other account is
 * created through the app's own invite flow — this script
 * exists purely to solve the bootstrapping problem ("how do you
 * invite the first user when there's no admin yet to invite
 * them").
 *
 * Usage:
 *   npm run seed:admin -- --username admin --password 'Some-Strong-P4ssword!'
 *
 * Requires the same env vars as the running app (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_ORG_ID
 * ─────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { buildSyntheticEmail, normaliseUsername, assertValidUsername } from '../lib/auth/synthetic-email';

function parseArgs(): { username: string; password: string; firstName: string; lastName: string } {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx === args.length - 1) return fallback;
    return args[idx + 1];
  };

  const username = get('--username');
  const password = get('--password');

  if (!username || !password) {
    console.error('Usage: npm run seed:admin -- --username <username> --password <password> [--first-name <name>] [--last-name <name>]');
    process.exit(1);
  }

  return {
    username,
    password,
    firstName: get('--first-name', 'Super') as string,
    lastName: get('--last-name', 'Admin') as string,
  };
}

async function main() {
  const { username, password, firstName, lastName } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orgId = process.env.DEFAULT_ORG_ID;

  if (!url || !serviceRoleKey || !orgId) {
    console.error('Missing required env vars. Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_ORG_ID in .env.local.');
    process.exit(1);
  }

  const normalisedUsername = normaliseUsername(username);
  assertValidUsername(normalisedUsername); // throws with a clear message if invalid

  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const syntheticEmail = buildSyntheticEmail(normalisedUsername, orgId);

  console.log(`Creating super_admin "${normalisedUsername}" for org ${orgId}...`);

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: { username: normalisedUsername, org_id: orgId },
  });

  if (authError || !authUser?.user) {
    console.error('Failed to create auth user:', authError?.message);
    process.exit(1);
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    org_id: orgId,
    username: normalisedUsername,
    display_name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    role: 'super_admin',
    status: 'active',
    must_change_password: false,
    activated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error('Failed to create profile row:', profileError.message);
    console.error('Rolling back the orphaned auth user...');
    await admin.auth.admin.deleteUser(authUser.user.id);
    process.exit(1);
  }

  console.log('\n✓ Super admin created successfully.');
  console.log(`  Username: ${normalisedUsername}`);
  console.log(`  Org ID:   ${orgId}`);
  console.log('\nYou can now log in at /login with this username and the password you provided.\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
