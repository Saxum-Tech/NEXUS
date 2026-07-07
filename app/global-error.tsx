/**
 * app/global-error.tsx
 * ─────────────────────────────────────────────────────────────
 * Catches errors in the root layout itself (rare but must
 * exist to prevent a blank white screen).
 *
 * INTENTIONAL DESIGN DECISIONS:
 *
 * 1. Inline styles — this file must work even when the root
 *    layout (and therefore the CSS pipeline / Next.js style
 *    injection) has crashed. CSS modules are unavailable here
 *    by definition. Keep styles minimal and self-contained.
 *
 * 2. console.error — lib/logger.ts and any monitoring SDK may
 *    be unreachable if the error occurred during module init.
 *    Replace with Sentry.captureException() or equivalent once
 *    you know your SDK initialises before layout rendering.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // See comment at top of file for why console.error is used here.
    // eslint-disable-next-line no-console
    console.error('[global error]', error);
  }, [error]);

  // Inline styles are intentional — see file comment above.
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 480 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f1117' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#555b6a', marginBottom: '1rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
          A critical error occurred. Please refresh the page.
          {error.digest && (
            <span style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.75rem', opacity: 0.7 }}>
              Reference: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '8px 16px',
            background: '#6c4de6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
