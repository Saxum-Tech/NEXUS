/**
 * app/error.tsx
 * Next.js renders this when an unhandled error occurs in the
 * (app) or (admin) route group during rendering.
 */

'use client';

import { useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentional console.error — this fires before any logging
    // infrastructure (lib/logger.ts, Sentry, etc.) is guaranteed
    // to be available. Replace with your monitoring SDK's captureException()
    // here: e.g. Sentry.captureException(error)
    // eslint-disable-next-line no-console
    console.error('[unhandled error]', error);
  }, [error]);

  return (
    <PageShell
      title="Something went wrong"
      actions={<Button variant="primary" onClick={reset}>Try again</Button>}
    >
      <Alert variant="danger">
        An unexpected error occurred. If this keeps happening, contact your administrator.
        {error.digest && (
          <span style={{ display: 'block', fontSize: 'var(--text-xs)', marginTop: 4, opacity: 0.7 }}>
            Reference: {error.digest}
          </span>
        )}
      </Alert>
    </PageShell>
  );
}
