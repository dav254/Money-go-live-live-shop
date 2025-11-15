import { MainLayout } from '@/components/layout/main-layout';
import { DollarSign } from 'lucide-react';

export default function SellerEarningsPage() {
  return (
    <MainLayout>
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <DollarSign className="h-12 w-12 text-primary" />
        </div>
        <h1 className="font-headline text-2xl font-bold">Earnings</h1>
        <p className="max-w-xs text-muted-foreground">
          Track your sales and payouts.
        </p>
      </div>
    </MainLayout>
  );
}
