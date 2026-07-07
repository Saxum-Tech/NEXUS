/**
 * lib/api/response.ts
 * ─────────────────────────────────────────────────────────────
 * Typed response helpers for Route Handlers. Eliminates the
 * repeated NextResponse.json({ error: '...' }, { status: N })
 * pattern and gives every error response a consistent shape
 * that the client can rely on.
 *
 * Every error response has the shape:
 *   { error: string, issues?: { field: string, message: string }[] }
 *
 * Every success response has the shape:
 *   { ...data }    (caller decides the data shape)
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { formatZodError } from '@/lib/validation/schemas';

// ── Error responses ───────────────────────────────────────────

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: 'Validation failed.', issues: formatZodError(error) },
    { status: 400 }
  );
}

export function unauthorized(message = 'Not authenticated.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'You do not have permission to perform this action.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Resource not found.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function tooManyRequests(retryAfterSeconds = 60): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}

export function serverError(message = 'An unexpected error occurred.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

// ── Success responses ─────────────────────────────────────────

export function ok<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created<T extends Record<string, unknown>>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ── Body parsing helper ───────────────────────────────────────

/**
 * Safely parses a request body as JSON. Returns the parsed body
 * or a 400 NextResponse if the body is missing or malformed.
 * Use at the top of every Route Handler that accepts a body.
 *
 * Usage:
 *   const result = await parseBody(request);
 *   if (result instanceof NextResponse) return result;
 *   const { body } = result;
 */
export async function parseBody(
  request: Request
): Promise<{ body: unknown } | NextResponse> {
  try {
    const body = await request.json();
    return { body };
  } catch {
    return badRequest('Invalid or missing request body.');
  }
}
