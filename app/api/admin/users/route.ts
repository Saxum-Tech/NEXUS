/**
 * app/api/admin/users/route.ts
 * ─────────────────────────────────────────────────────────────
 * Lists users in the caller's org with search, role/status
 * filters, and pagination. Used by the admin Users table.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  parseBody,
  serverError,
  unauthorized,
  validationError,
} from '@/lib/api/response';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/guard';
import { PERMISSIONS, APP_ROLES, USER_STATUSES, type AppRole, type UserStatus } from '@/lib/auth/roles';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const roleFilter = url.searchParams.get('role') as AppRole | null;
  const statusFilter = url.searchParams.get('status') as UserStatus | null;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

  const admin = createSupabaseAdminClient();

  let query = admin
    .from('profiles')
    .select(
      'id, username, display_name, contact_email, role, status, department, created_at',
      { count: 'exact' }
    )
    .eq('org_id', actor.orgId)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%,contact_email.ilike.%${search}%`
    );
  }

  if (roleFilter && APP_ROLES.includes(roleFilter)) {
    query = query.eq('role', roleFilter);
  }

  if (statusFilter && USER_STATUSES.includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return serverError('Could not load users.');
  }

  return ok({
    users: data,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    },
  });
}
