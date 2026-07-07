import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <PageShell title="Dashboard">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton variant="text" style={{ width: '60%', marginBottom: 8 }} />
            <Skeleton variant="block" style={{ height: 32 }} />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton variant="block" style={{ height: 100 }} />
      </Card>
    </PageShell>
  );
}
