/**
 * middleware.ts
 * ─────────────────────────────────────────────────────────────
 * Runs on every request. Jobs:
 *
 *   1. Refresh the Supabase session cookie so users stay logged
 *      in across a long session without needing a page reload.
 *
 *   2. Enforce session_timeout_minutes: if the user has been
 *      inactive longer than the org's configured timeout, sign
 *      them out and redirect to /login. "Last activity" is
 *      tracked as a lightweight cookie updated on each request —
 *      no DB write per request.
 *
 *   3. Redirect unauthenticated requests away from protected
 *      routes, and authenticated requests away from /login.
 *
 * NOTE — limit_concurrent_sessions: true is enforced at the
 * *login* step (see app/api/auth/login/route.ts) by calling
 * Supabase's signOut('global') before signing back in, rather
 * than here in middleware, because middleware runs on every
 * request and would be too expensive a place to check for
 * concurrency (it would require a DB query per request).
 * ─────────────────────────────────────────────────────────────
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  '/login',
  '/set-password',
  '/api/auth/login',
  '/api/auth/set-password',
];

const LAST_ACTIVITY_COOKIE = 'app_last_activity';
// Default timeout in ms used if org config can't be read.
// Middleware can't call the DB (too expensive per request), so we
// cache the per-org timeout in the session cookie itself — set at
// login time by the login route (see app/api/auth/login/route.ts),
// read here on every subsequent request.
const SESSION_TIMEOUT_COOKIE = 'app_session_timeout_ms';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const isAuthenticated = !!data.user;
  const { pathname } = request.nextUrl;

  if (!isAuthenticated) {
    if (!isPublicPath(pathname) && pathname !== '/') {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // ── Session inactivity timeout enforcement ─────────────────
  // Only check on page/API navigations, not on static asset
  // requests (already excluded by the matcher below).
  if (!isPublicPath(pathname)) {
    const now = Date.now();
    const lastActivity = parseInt(
      request.cookies.get(LAST_ACTIVITY_COOKIE)?.value ?? '0',
      10
    );
    const timeoutMs = parseInt(
      request.cookies.get(SESSION_TIMEOUT_COOKIE)?.value ?? String(DEFAULT_TIMEOUT_MS),
      10
    );

    if (lastActivity > 0 && now - lastActivity > timeoutMs) {
      // Inactivity limit exceeded — sign out and redirect.
      await supabase.auth.signOut();
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('reason', 'timeout');
      const timeoutResponse = NextResponse.redirect(redirectUrl);
      timeoutResponse.cookies.delete(LAST_ACTIVITY_COOKIE);
      timeoutResponse.cookies.delete(SESSION_TIMEOUT_COOKIE);
      return timeoutResponse;
    }

    // Stamp last activity on every authenticated, non-public request.
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      // No explicit maxAge — session cookie (cleared when browser closes).
    });
  }

  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
