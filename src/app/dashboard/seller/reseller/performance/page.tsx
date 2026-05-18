
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function ResellerPerformancePage() {
    return (
        <SellerLayout>
            <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8 text-center">
                <Card className="max-w-md border-white/5 bg-neutral-900/50">
                    <CardHeader>
                        <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                            <Users className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Reseller Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-neutral-500">
                            We are building a powerful dashboard to help you track your top-performing resellers. 
                            Soon you'll be able to see who is driving the most traffic and sales to your shop.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
