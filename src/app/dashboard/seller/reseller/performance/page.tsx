
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResellerAnalyticsTable } from '@/components/seller/reseller-analytics-table';
import { SellerTopSharedProductsTable } from '@/components/seller/seller-top-shared-products-table';
import { Users, TrendingUp, Award } from 'lucide-react';

export default function ResellerPerformancePage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Reseller Performance</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-neutral-900 border-white/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Award className="text-primary h-5 w-5" />
                                Top Earning Resellers
                            </CardTitle>
                            <CardDescription>Resellers driving the most verified sales for your shop.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResellerAnalyticsTable />
                        </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border-white/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="text-primary h-5 w-5" />
                                Viral Visibility
                            </CardTitle>
                            <CardDescription>Products being shared most frequently across the network.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SellerTopSharedProductsTable />
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Reseller Strategy Tip</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-white/70 leading-relaxed">
                            Resellers with high share counts but low sales might need better product videos. Use the <strong className="text-white uppercase tracking-tight">AI Content Generator</strong> to create viral captions for them to use!
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
