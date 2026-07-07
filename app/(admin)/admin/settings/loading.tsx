import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <PageShell title="App settings">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <Skeleton variant="title" style={{ marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Skeleton variant="block" style={{ height: 60 }} />
            <Skeleton variant="block" style={{ height: 60 }} />
          </div>
          <Skeleton variant="block" style={{ height: 60 }} />
        </Card>
      ))}
    </PageShell>
  );
}
