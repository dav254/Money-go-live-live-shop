import { MainLayout } from '@/components/layout/main-layout';
import { AreaChart } from 'lucide-react';

export default function SellerDashboardPage() {
  return (
    <MainLayout>
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <AreaChart className="h-12 w-12 text-primary" />
        </div>
        <h1 className="font-headline text-2xl font-bold">Seller Dashboard</h1>
        <p className="max-w-xs text-muted-foreground">
          Welcome to your command center. Manage your products, orders, and sales from here.
        </p>
      </div>
    </MainLayout>
  );
}
