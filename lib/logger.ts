/**
 * lib/logger.ts
 * ─────────────────────────────────────────────────────────────
 * Minimal structured logger. In development it writes JSON to
 * stdout (readable, diffable). In production swap the `emit`
 * function for your observability platform of choice (Datadog,
 * Sentry, Axiom, Pino transport, etc.) — the call sites don't
 * change.
 *
 * Server-only. Never import from client components.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function emit(payload: LogPayload): void {
  // Replace this with your production logging transport.
  // e.g. Axiom: axiom.ingest('logs', [payload])
  // e.g. Pino:  pino[payload.level](payload, payload.msg)
  const line = JSON.stringify({ ts: new Date().toISOString(), ...payload });
  if (payload.level === 'error' || payload.level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: 'debug', msg, ...ctx }),

  info: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: 'info', msg, ...ctx }),

  warn: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: 'warn', msg, ...ctx }),

  error: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: 'error', msg, ...ctx }),
};
