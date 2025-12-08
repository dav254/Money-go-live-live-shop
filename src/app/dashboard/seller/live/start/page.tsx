
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';
import Link from 'next/link';

export default function GoLivePage() {

  return (
     <SellerLayout>
        <div className="container mx-auto max-w-6xl py-8">
           <div className="flex h-full flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed p-12">
                <CardTitle className="flex items-center gap-2 text-2xl">
                    <Video className="text-primary" />
                    Ready to Go Live?
                </CardTitle>
                <p className="text-muted-foreground max-w-md">
                    All live streaming activities, including starting a new show, are now managed from your central Live Studio.
                </p>
                <Button asChild size="lg">
                    <Link href="/dashboard/seller/studio">
                        Go to Live Studio
                    </Link>
                </Button>
            </div>
        </div>
     </SellerLayout>
  );
}
