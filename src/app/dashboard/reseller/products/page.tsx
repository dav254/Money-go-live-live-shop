
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { ProductCard } from '@/components/seller/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products } from '@/lib/placeholder-data';
import { Bot, Filter, Percent, Search, Share2, TrendingUp, Sparkles } from 'lucide-react';

const ResellerProductCard = ({ product }: { product: typeof products[0] }) => (
    <Card className="overflow-hidden">
        <div className="relative aspect-video">
            <ProductCard product={product} />
            <Badge className="absolute top-2 left-2 bg-green-600/80">15% Commission</Badge>
        </div>
        <CardContent className="p-3">
             <div className="flex gap-2">
                <Button size="sm" className="flex-1"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                <Button size="sm" variant="secondary" className="flex-1"><Sparkles className="mr-2 h-4 w-4" /> Get Media</Button>
            </div>
        </CardContent>
    </Card>
);

export default function ResellerProductsPage() {
  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Products to Resell
        </h1>

        <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-9" />
            </div>
            <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-5">
            <TabsTrigger value="all">All Products</TabsTrigger>
            <TabsTrigger value="trending"><TrendingUp className="mr-1 h-4 w-4" /> Trending</TabsTrigger>
            <TabsTrigger value="high-commission"><Percent className="mr-1 h-4 w-4" /> High Commission</TabsTrigger>
            <TabsTrigger value="ai-recommended"><Bot className="mr-1 h-4 w-4" /> Recommended</TabsTrigger>
            <TabsTrigger value="new">New Arrivals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map(p => <ResellerProductCard key={p.id} product={p} />)}
            </div>
          </TabsContent>
           <TabsContent value="trending" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.slice(0, 3).map(p => <ResellerProductCard key={p.id} product={p} />)}
            </div>
          </TabsContent>
           <TabsContent value="high-commission" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.slice(2, 5).map(p => <ResellerProductCard key={p.id} product={p} />)}
            </div>
          </TabsContent>
          <TabsContent value="ai-recommended" className="mt-6">
             <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">AI recommendations will appear here based on your performance.</p>
            </div>
          </TabsContent>
           <TabsContent value="new" className="mt-6">
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.slice(1, 4).map(p => <ResellerProductCard key={p.id} product={p} />)}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </ResellerLayout>
  );
}
