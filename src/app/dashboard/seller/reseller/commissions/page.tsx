
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgePercent } from 'lucide-react';

export default function CommissionsPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Commissions
        </h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgePercent />
              Set Commission Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">
                Define fixed or percentage-based commissions for your products here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
