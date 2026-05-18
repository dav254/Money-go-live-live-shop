
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

export default function SellerMarketingPage() {
    return (
        <SellerLayout>
            <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8 text-center">
                <Card className="max-w-md border-white/5 bg-neutral-900/50">
                    <CardHeader>
                        <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                            <Megaphone className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Marketing Center</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-neutral-500">
                            The Marketing Center is currently under construction. 
                            Soon you'll be able to create coupons, manage promos, and run custom campaigns from here.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
