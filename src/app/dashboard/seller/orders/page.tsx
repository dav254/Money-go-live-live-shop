import { MainLayout } from '@/components/layout/main-layout';
import { Package } from 'lucide-react';

export default function SellerOrdersPage() {
  return (
    <MainLayout>
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Package className="h-12 w-12 text-primary" />
        </div>
        <h1 className="font-headline text-2xl font-bold">Pending Orders</h1>
        <p className="max-w-xs text-muted-foreground">
          Manage your incoming orders here.
        </p>
      </div>
    </MainLayout>
  );
}
