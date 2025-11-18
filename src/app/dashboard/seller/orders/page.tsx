

import { SellerLayout } from '@/components/layout/seller-layout';
import { InCartsTable } from '@/components/seller/in-carts-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart } from 'lucide-react';

export default function SellerOrdersPage() {
  return (
    <SellerLayout>
       <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Potential Sales
        </h1>
        <Tabs defaultValue="in-carts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="in-carts">
              <ShoppingCart className="mr-2 h-4 w-4" />
              In Carts
            </TabsTrigger>
            <TabsTrigger value="pending-orders">
              <Package className="mr-2 h-4 w-4" />
              Pending Orders
            </TabsTrigger>
             <TabsTrigger value="completed-orders">
              Completed Orders
            </TabsTrigger>
          </TabsList>
          <TabsContent value="in-carts" className="space-y-4">
            <InCartsTable />
          </TabsContent>
          <TabsContent value="pending-orders" className="space-y-4">
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <h2 className="text-xl font-semibold">No Pending Orders</h2>
                <p className="text-muted-foreground">New orders from buyers will appear here.</p>
            </div>
          </TabsContent>
          <TabsContent value="completed-orders" className="space-y-4">
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <h2 className="text-xl font-semibold">No Completed Orders Yet</h2>
                <p className="text-muted-foreground">Your fulfilled orders and history will show up here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}

