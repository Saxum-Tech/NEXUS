import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfileLoading() {
  return (
    <PageShell title="My profile">
      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2].map((i) => (
          <Card key={i}>
            <Skeleton variant="title" style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton variant="text" style={{ width: '70%' }} />
              <Skeleton variant="text" style={{ width: '55%' }} />
              <Skeleton variant="text" style={{ width: '40%' }} />
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
