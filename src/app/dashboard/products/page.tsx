
import { MainLayout } from '@/components/layout/main-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { MyProductsTable } from '@/components/seller/my-products-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProductsPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Products
        </h1>
        <Tabs defaultValue="my-products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="my-products">My Products</TabsTrigger>
            <TabsTrigger value="add-new">Add New</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
          </TabsList>
          <TabsContent value="my-products" className="space-y-4">
            <MyProductsTable />
          </TabsContent>
          <TabsContent value="add-new" className="space-y-4">
            <ProductUploadForm />
          </TabsContent>
          <TabsContent value="discounts" className="space-y-4">
             <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">Create and manage discounts and offers here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
