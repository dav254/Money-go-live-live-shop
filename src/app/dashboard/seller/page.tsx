
'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Heart, Eye } from 'lucide-react';
import type { SellerShop, Product } from '@/lib/types';
import { collection, doc, query, where, deleteDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { ScrollArea } from '@/components/ui/scroll-area';


const ProductRowSkeleton = () => (
  <div className="bg-card p-4 rounded-xl shadow-md flex gap-4 items-center">
    <Skeleton className="w-20 h-20 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-1/5" />
    </div>
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
)

export default function SellerDashboardPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | undefined>(undefined);

  const sellerShopRef = useMemoFirebase(() => {
    if (!user) return null;
    return firestore ? doc(firestore, `sellerShops/${user.uid}`) : null;
  }, [firestore, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return firestore ? query(collection(firestore, 'products'), where('sellerId', '==', user.uid)) : null;
  },[firestore, user]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const isLoading = isUserLoading || isShopLoading || areProductsLoading;

  const { totalLikes, totalViews } = React.useMemo(() => {
    if (!products) return { totalLikes: 0, totalViews: 0 };
    const likes = products.reduce((sum, product) => sum + (product.likes || 0), 0);
    const views = products.reduce((sum, product) => sum + (product.viewCount || 0), 0);
    return { totalLikes: likes, totalViews: views };
  }, [products]);
  
  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', productId);
    try {
        await deleteDoc(productRef);
        toast({ title: "Product Deleted", description: "The product has been successfully removed." });
    } catch (e) {
        console.error("Error deleting product: ", e);
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the product." });
    }
  };
  
  const handleEditOpen = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  }

  return (
    <SellerLayout>
      <div className="p-4 bg-background min-h-full">
        {/* Seller Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image
              src={shopData?.logoUrl || "https://picsum.photos/seed/avatar/50/50"}
              width={48}
              height={48}
              alt="Seller Avatar"
              className="w-12 h-12 rounded-full object-cover"
              data-ai-hint="seller avatar"
            />
            <div>
              <h2 className="text-lg font-bold font-headline">{shopData?.shopName || 'Seller Store'}</h2>
              <p className="text-sm text-muted-foreground">Wallet: 4,200</p>
            </div>
          </div>

          <Button variant="destructive" className="rounded-xl font-bold">
            Go Live
          </Button>
        </div>
        
        {/* Shop Analytics Section */}
        <div className="mb-6">
          <h3 className="font-headline text-xl font-bold mb-4">Shop Analytics</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Followers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-bold">{shopData?.followers?.toLocaleString() || 0}</div>}
                <p className="text-xs text-muted-foreground">+2 since last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 {isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-bold">{totalLikes.toLocaleString()}</div>}
                <p className="text-xs text-muted-foreground">Across all products</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Product Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>}
                <p className="text-xs text-muted-foreground">In the last 30 days</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-4 text-sm pb-2">
            <Button asChild variant="default" className="rounded-xl shadow-sm whitespace-nowrap"><Link href="/dashboard/seller">My Products</Link></Button>
            <Button asChild variant="secondary" className="rounded-xl shadow-sm whitespace-nowrap"><Link href="/dashboard/products">Live</Link></Button>
            <Button asChild variant="secondary" className="rounded-xl shadow-sm whitespace-nowrap"><Link href="/dashboard/seller/orders">Orders</Link></Button>
            <Button asChild variant="secondary" className="rounded-xl shadow-sm whitespace-nowrap"><Link href="/dashboard/seller/earnings">Analytics</Link></Button>
        </div>

        {/* Add Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Button className="font-semibold" style={{ backgroundColor: '#2563eb' }}>Add Product</Button>
          <Button className="font-semibold" style={{ backgroundColor: '#7c3aed' }}>Add Video</Button>
          <Button className="font-semibold" style={{ backgroundColor: '#16a34a' }}>Add Live</Button>
        </div>

        {/* Product List */}
        <div className="space-y-4">
          <h3 className="font-headline text-xl font-bold">My Products</h3>
          {isLoading ? (
            <>
              <ProductRowSkeleton />
              <ProductRowSkeleton />
            </>
          ) : products && products.length > 0 ? (
              products.map((p) => {
                const status = (p.stock || 0) > 0 ? "Active" : "Out of Stock";
                return (
                  <AlertDialog key={p.id}>
                  <div
                    className="bg-card p-4 rounded-xl shadow-md flex gap-4 items-center"
                  >
                    <Image 
                      src={p.imageUrl || "https://picsum.photos/seed/product/80/80"}
                      width={80}
                      height={80}
                      alt={p.name || 'product'}
                      className="w-20 h-20 rounded-lg object-cover"
                    />

                    <div className="flex-1">
                      <h3 className="font-bold font-headline">{p.name}</h3>
                      <p className="font-semibold text-primary">{p.price?.toLocaleString()}</p>

                      <div className="text-sm text-muted-foreground mt-1 flex gap-4">
                          <span>Stock: {p.stock || 0}</span>
                          <span>Views: {p.viewCount || 0}</span>
                      </div>
                      
                      <p
                        className={`text-sm mt-1 font-bold ${
                          status === "Active" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {status}
                      </p>
                    </div>
                      <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleEditOpen(p)}>
                          Edit
                          </Button>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="w-full">
                                Delete
                            </Button>
                          </AlertDialogTrigger>
                    </div>
                  </div>
                   <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete "{p.name}". This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
              })
          ) : (
             <p className="text-muted-foreground text-center py-8">You have not uploaded any products yet.</p>
          )}
        </div>
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-3xl grid-rows-[auto_1fr] p-0 max-h-[90vh]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Edit Product</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-full">
                  <div className="p-6 pt-0">
                    <ProductUploadForm 
                        productToEdit={selectedProduct} 
                        onFormSubmit={() => setIsEditDialogOpen(false)} 
                    />
                  </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );

    