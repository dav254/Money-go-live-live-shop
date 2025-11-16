
import { AdminLayout } from '@/components/layout/admin-layout';

export default function AdminSecurityPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          System & Settings: Security & 2FA
        </h1>
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed p-12">
            <p className="text-muted-foreground">Platform-wide security settings will be here.</p>
        </div>
      </div>
    </AdminLayout>
  );
}

    