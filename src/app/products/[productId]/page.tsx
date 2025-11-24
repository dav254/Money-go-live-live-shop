
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Pencil,
  Trash2,
  Upload,
  Eye,
  ShoppingCart,
  Heart,
  Bookmark,
  MessageSquare,
  BarChart2,
  Share2,
  Video,
  DollarSign,
  Info,
  ShieldCheck,
  Star,
  Users,
  Box,
  Tags,
  FileText,
  Search,
  Truck,
  MapPin,
  ClipboardList,
  UploadCloud,
} from 'lucide-react';
import Image from 'next/image';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useParams } from 'next/navigation';
import type { Product } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart } from 'recharts';

const chartData = [
  { date: 'Mon', views: 186 },
  { date: 'Tue', views: 305 },
  { date: 'Wed', views: 237 },
  { date: 'Thu', views: 73 },
  { date: 'Fri', views: 209 },
  { date: 'Sat', views: 214 },
  { date: 'Sun', views: 350 },
];

const chartConfig = {
  views: {
    label: 'Views',
    color: 'hsl(var(--primary))',
  },
};

const ProductPageSkeleton = () => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                 <Skeleton className="aspect-square w-full" />
                 <div className="flex gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                 </div>
            </div>
            <div className="lg:col-span-2">
                 <Skeleton className="h-full w-full min-h-96" />
            </div>
        </div>
    </div>
);


export default function SellerProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string;
  const firestore = useFirestore();

  const productRef = useMemoFirebase(() => {
    if (!firestore || !productId) return null;
    return doc(firestore, 'products', productId);
  }, [firestore, productId]);

  const { data: product, isLoading, error } = useDoc<Product>(productRef);

  if (isLoading) {
      return (
          <SellerLayout>
            <div className="p-8">
              <ProductPageSkeleton />
            </div>
          </SellerLayout>
      )
  }

  if (error || !product) {
       return (
          <SellerLayout>
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold">Product Not Found</h2>
              <p className="text-muted-foreground">The product you are looking for does not exist or you do not have permission to view it.</p>
            </div>
          </SellerLayout>
      )
  }

  const discountPercentage = product.wasPrice && product.price
    ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100)
    : 0;

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* 1. Product Overview (Top Section) */}
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                    <Badge variant={product.stock > 0 ? 'default' : 'destructive'} className={product.stock > 0 ? 'bg-green-600/80' : ''}>
                        {product.stock > 0 ? 'Active' : 'Out of Stock'}
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Product ID: {product.id}</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" /> Promote</Button>
                <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" /> View as Buyer</Button>
                 <Button variant="destructive-outline" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="lg:col-span-1 xl:col-span-1 space-y-6">
                {/* Cover Image & Price */}
                <Card>
                    <CardContent className="p-4">
                        <div className="aspect-square relative w-full overflow-hidden rounded-md">
                            <Image src={product.imageUrl || 'https://picsum.photos/seed/product/400'} alt={product.name || 'Product image'} fill className="object-cover" />
                        </div>
                    </CardContent>
                </Card>

                 {/* 4. Pricing Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><DollarSign /> Pricing & Earnings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">Selling Price</span>
                            <span className="font-bold text-xl">{product.price.toLocaleString()} KES</span>
                        </div>
                        {discountPercentage > 0 && product.wasPrice && (
                             <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">Was Price</span>
                                <span className="line-through">{product.wasPrice.toLocaleString()} KES</span>
                            </div>
                        )}
                        <Separator />
                        <div className="text-xs space-y-2 text-muted-foreground">
                            <div className="flex justify-between"><span>Platform Fee (5%)</span><span>-{(product.price * 0.05).toLocaleString()} KES</span></div>
                            <div className="flex justify-between"><span>Reseller Commission (10%)</span><span>-{(product.price * 0.10).toLocaleString()} KES</span></div>
                            <div className="flex justify-between font-bold text-foreground"><span>Your Earnings</span><span>{(product.price * 0.85).toLocaleString()} KES</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                 <Tabs defaultValue="details">
                    <TabsList>
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="media">Media</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="reviews">Reviews</TabsTrigger>
                        <TabsTrigger value="resellers">Resellers</TabsTrigger>
                        <TabsTrigger value="inventory">Inventory</TabsTrigger>
                        <TabsTrigger value="seo">SEO</TabsTrigger>
                    </TabsList>
                    
                    {/* 3. Product Details Section */}
                    <TabsContent value="details" className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText /> Product Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-sm text-muted-foreground">Category</p><p>{product.category}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Condition</p><p>New</p></div>
                                    <div><p className="text-sm text-muted-foreground">Stock</p><p>{product.stock}</p></div>
                                    <div><p className="text-sm text-muted-foreground">SKU</p><p>AHS-0012</p></div>
                                </div>
                                <div><p className="text-sm text-muted-foreground">Description</p><p>{product.description}</p></div>
                            </CardContent>
                        </Card>
                         {/* 5. Delivery & Logistics Section */}
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Truck /> Delivery & Logistics</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div><p className="text-sm text-muted-foreground">Pickup Location</p><p>{product.location}</p></div>
                                <div><p className="text-sm text-muted-foreground">Delivery Options</p><p>{product.deliveryOptions}</p></div>
                                <div><p className="text-sm text-muted-foreground">Delivery Fee</p><p>{product.shippingCost?.toLocaleString() || 0} KES</p></div>
                                <div><p className="text-sm text-muted-foreground">Return Policy</p><p>7-day returns accepted.</p></div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 2. Product Media Manager */}
                    <TabsContent value="media">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Video /> Media Manager</CardTitle>
                                <CardDescription>Drag and drop to reorder. The first image is the cover.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {(product.imageUrls || [product.imageUrl]).map((url, i) => (
                                        <div key={i} className="relative aspect-square group">
                                            <Image src={url || ''} alt={`media ${i}`} fill className="object-cover rounded-md" />
                                            {i===0 && <Badge className="absolute top-2 left-2">Cover</Badge>}
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-center aspect-square border-2 border-dashed rounded-md cursor-pointer hover:border-primary">
                                        <UploadCloud />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 6. Product Insights / Analytics */}
                    <TabsContent value="analytics">
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart2 /> Product Analytics</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
                                    <div><p className="text-2xl font-bold">1.2k</p><p className="text-xs text-muted-foreground">Views</p></div>
                                    <div><p className="text-2xl font-bold">89</p><p className="text-xs text-muted-foreground">Likes</p></div>
                                    <div><p className="text-2xl font-bold">45</p><p className="text-xs text-muted-foreground">Added to Cart</p></div>
                                    <div><p className="text-2xl font-bold text-primary">5.2%</p><p className="text-xs text-muted-foreground">Conversion</p></div>
                                </div>
                                <ChartContainer config={chartConfig} className="h-64 w-full">
                                    <RechartsBarChart data={chartData}>
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                        <Bar dataKey="views" fill="var(--color-views)" radius={4} />
                                    </RechartsBarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 8. Reviews & Ratings Section */}
                    <TabsContent value="reviews">
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star /> Reviews & Ratings</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-center p-8 border border-dashed rounded-md">
                                    <p className="text-muted-foreground">No reviews yet.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    {/* 7. Reseller Participation Section */}
                    <TabsContent value="resellers">
                        <Card>
                             <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users /> Reseller Participation</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div><p className="text-xl font-bold">23</p><p className="text-xs text-muted-foreground">Resellers</p></div>
                                    <div><p className="text-xl font-bold">34</p><p className="text-xs text-muted-foreground">Sales</p></div>
                                    <div><p className="text-xl font-bold text-green-500">12,300</p><p className="text-xs text-muted-foreground">Commission Paid</p></div>
                                </div>
                                <div className="flex gap-2">
                                     <Button className="w-full">Make Product Resellable</Button>
                                     <Button variant="secondary">Set Commission %</Button>
                                </div>
                             </CardContent>
                        </Card>
                    </TabsContent>

                     {/* 10. Inventory & Stock Management */}
                    <TabsContent value="inventory">
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Box /> Inventory Management</CardTitle></CardHeader>
                            <CardContent>
                               <div className="text-center p-8 border border-dashed rounded-md">
                                    <p className="text-muted-foreground">Inventory history will be shown here.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                     {/* 11. SEO & Visibility */}
                    <TabsContent value="seo">
                        <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Search /> SEO & Visibility</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Input label="Meta Title" defaultValue={product.name} />
                                <Textarea label="Meta Description" defaultValue={product.description} />
                                <Input label="Keywords" defaultValue={product.tags} />
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <p>Visibility</p>
                                    <Switch defaultChecked />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </div>
      </div>
    </SellerLayout>
  );
}
