import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AuditLoading() {
  return (
    <PageShell title="Audit log" description="Append-only record of every privileged action.">
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Skeleton variant="text" style={{ width: 130 }} />
              <Skeleton variant="text" style={{ width: 100 }} />
              <Skeleton variant="text" style={{ width: 80 }} />
              <Skeleton variant="text" style={{ width: '25%', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
