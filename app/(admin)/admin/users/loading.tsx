/**
 * app/(admin)/admin/users/loading.tsx
 * Shown by Next.js while the page Server Component streams in.
 */

import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function UsersLoading() {
  return (
    <PageShell title="User management">
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Skeleton variant="block" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
              <Skeleton variant="text" style={{ width: `${40 + (i % 3) * 15}%` }} />
              <Skeleton variant="text" style={{ width: '18%', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
