
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';

export default function SellerLiveHistoryPage() {
  return (
    <SellerLayout>
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8 text-center">
        <Card className="max-w-md border-white/5 bg-neutral-900/50">
            <CardHeader>
                <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                    <Video className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Broadcast History</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-neutral-500">
                    This section is being optimized to provide deeper insights into your live performance. 
                    Check back soon to see your stream stats, viewer engagement, and live sales data.
                </p>
            </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
