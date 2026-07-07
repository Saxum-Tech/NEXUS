/**
 * app/api/health/route.ts
 * ─────────────────────────────────────────────────────────────
 * Lightweight health check. Returns 200 when the app process
 * is up and can reach Supabase, 503 if Supabase is unreachable.
 *
 * Used by:
 *   - Load balancers / reverse proxies (Vercel, Railway, etc.)
 *   - Uptime monitors (Better Uptime, UptimeRobot, etc.)
 *   - CI smoke tests after deployment
 *
 * Does NOT require authentication — it must be reachable
 * before any session exists.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic'; // never cache

export async function GET() {
  const start = Date.now();

  try {
    const admin = createSupabaseAdminClient();

    // Cheapest possible query — just check connectivity.
    const { error } = await admin.from('organisations').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'degraded',
          db: 'unreachable',
          error: error.message,
          latencyMs: Date.now() - start,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      latencyMs: Date.now() - start,
      version: process.env['npm_package_version'] ?? 'unknown',
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'unknown',
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }
}
