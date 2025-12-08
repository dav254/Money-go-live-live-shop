
'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { MyProductsTable } from '@/components/seller/my-products-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscountedProductsTable } from '@/components/seller/discounted-products-table';
import { LogisticsTable } from '@/components/seller/logistics-table';
import { AiRecordsTable } from '@/components/seller/ai-records-table';

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'my-products';

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Products
        </h1>
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="my-products">My Products</TabsTrigger>
            <TabsTrigger value="add-new">Add New</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="ai-records">AI Records</TabsTrigger>
            <TabsTrigger value="logistics">Logistics</TabsTrigger>
          </TabsList>
          <TabsContent value="my-products" className="space-y-4" forceMount={false}>
            <MyProductsTable />
          </TabsContent>
          <TabsContent value="add-new" className="space-y-4" forceMount={false}>
            <ProductUploadForm />
          </TabsContent>
          <TabsContent value="discounts" className="space-y-4" forceMount={false}>
             <DiscountedProductsTable />
          </TabsContent>
          <TabsContent value="ai-records" className="space-y-4" forceMount={false}>
             <AiRecordsTable />
          </TabsContent>
           <TabsContent value="logistics" className="space-y-4" forceMount={false}>
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
