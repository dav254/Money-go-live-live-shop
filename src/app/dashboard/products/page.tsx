'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { MyProductsTable } from '@/components/seller/my-products-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscountedProductsTable } from '@/components/seller/discounted-products-table';
import { LogisticsTable } from '@/components/seller/logistics-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Video, Upload, Sparkles } from 'lucide-react';
import Link from 'next/link';

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get('tab') || 'my-products';

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary mb-1">Product Studio</p>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Listings that sell</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Every field here feeds Vidnov discovery — the stronger your listing, the further it travels.</p>
          </div>
          <Button asChild className="rounded-xl vn-shadow-glow font-semibold">
            <Link href="/dashboard/products?tab=add-new"><Upload className="mr-2 h-4 w-4" /> New listing</Link>
          </Button>
        </div>
        
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="my-products" className="py-2">My Products</TabsTrigger>
            <TabsTrigger value="studio" className="py-2">Video Studio</TabsTrigger>
            <TabsTrigger value="add-new" className="py-2">Create Listing</TabsTrigger>
            <TabsTrigger value="discounts" className="py-2">Discounts</TabsTrigger>
            <TabsTrigger value="logistics" className="py-2">Logistics</TabsTrigger>
          </TabsList>

          <TabsContent value="my-products" className="space-y-4">
            <MyProductsTable />
          </TabsContent>

          <TabsContent value="studio" className="space-y-6 pt-4">
            <div className="max-w-2xl">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Video className="h-6 w-6 text-primary" />
                            <span>Manual Video Studio</span>
                        </CardTitle>
                        <CardDescription>Record or upload your own authentic product videos.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button className="w-full justify-start h-14 text-base font-semibold" variant="outline" asChild>
                            <Link href="/seller/studio/record">
                                <Video className="mr-3 h-5 w-5 text-primary" /> Record New Product Video
                            </Link>
                        </Button>
                        <Button className="w-full justify-start h-14 text-base font-semibold" variant="outline" disabled>
                            <Upload className="mr-3 h-5 w-5 text-muted-foreground" /> Upload Existing File (Coming Soon)
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="font-bold">Pro Tip</AlertTitle>
                <AlertDescription>
                    Products with video content have a <span className="font-bold">10x higher conversion rate</span>. Use the studio to bring your items to life!
                </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="add-new" className="space-y-4">
            <ProductUploadForm />
          </TabsContent>

          <TabsContent value="discounts" className="space-y-4">
             <DiscountedProductsTable />
          </TabsContent>

           <TabsContent value="logistics" className="space-y-4">
             <LogisticsTable />
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<SellerLayout><div className="flex-1 space-y-4 p-8 pt-6">Loading...</div></SellerLayout>}>
      <ProductsPageContent />
    </Suspense>
  )
}
