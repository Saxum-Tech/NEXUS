/**
 * app/not-found.tsx
 * Next.js renders this for any unmatched route (404).
 */

import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <PageShell
      title="Page not found"
      description="The page you're looking for doesn't exist or you don't have access to it."
      actions={
        <Link href="/dashboard">
          <Button variant="primary">Go to dashboard</Button>
        </Link>
      }
    >
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)' }}>
        404
      </p>
    </PageShell>
  );
}
