
'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Heart, Eye, Wallet, Clock, Package, Truck, MoreHorizontal, X, Radio, ArrowRight } from 'lucide-react';
import type { SellerShop, Product, Order, Payout, LiveSession } from '@/lib/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ProductRowSkeleton = () => (
  <div className="bg-card p-4 rounded-xl shadow-md flex gap-4 items-center">
    <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-12 sm:w-16" />
    </div>
  </div>
);

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

  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const payoutsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'payouts'), where('sellerId', '==', user.uid), where('status', '==', 'completed'));
  }, [firestore, user]);

  const liveSessionRef = useMemoFirebase(() => {
      if (!user) return null;
      return doc(firestore, 'liveSessions', user.uid);
  }, [firestore, user]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: payouts, isLoading: arePayoutsLoading } = useCollection<Payout>(payoutsQuery);
  const { data: activeSession } = useDoc<LiveSession>(liveSessionRef);

  const isLoading = isUserLoading || isShopLoading || areProductsLoading || areOrdersLoading || arePayoutsLoading;

  const { totalLikes, totalViews, availableBalance, orderStats } = React.useMemo(() => {
    const likes = products?.reduce((sum, product) => sum + (product.likes || 0), 0) || 0;
    const views = products?.reduce((sum, product) => sum + (product.viewCount || 0), 0) || 0;
    const completedOrders = orders?.filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped') || [];
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const balance = totalRevenue * 0.90 - (payouts?.reduce((sum, p) => sum + p.amount, 0) || 0);
    return { totalLikes: likes, totalViews: views, availableBalance: balance, orderStats: { pending: orders?.filter(o => o.orderStatus === 'pending').length || 0, processing: orders?.filter(o => o.orderStatus === 'processing').length || 0, shipped: orders?.filter(o => o.orderStatus === 'shipped').length || 0 } };
  }, [products, orders, payouts]);
  
  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    try { await deleteDoc(doc(firestore, 'products', productId)); toast({ title: "Product Deleted" }); } catch (e) { toast({ variant: 'destructive', title: "Error" }); }
  };

  // Improved check for session recovery
  const isSessionActive = React.useMemo(() => {
      if (!activeSession || activeSession.status === 'ended' || activeSession.timeRemainingMs <= 0) return false;
      const now = new Date();
      const initialStart = activeSession.initialStartTime?.toDate();
      const hoursDiff = initialStart ? (now.getTime() - initialStart.getTime()) / (1000 * 60 * 60) : 999;
      return hoursDiff < 24;
  }, [activeSession]);
  
  return (
    <SellerLayout>
      <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-full space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src={shopData?.logoUrl || "https://picsum.photos/seed/avatar/50/50"} width={56} height={56} alt="Logo" className="w-14 h-14 rounded-full object-cover border-2 border-primary/20 shadow-lg" />
            <div>
              <h2 className="text-xl font-black font-headline tracking-tight uppercase">{shopData?.shopName || 'Seller Store'}</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Store Dashboard</p>
            </div>
          </div>
        </div>

        {isSessionActive && (
            <Card className="bg-primary/10 border-primary/20 animate-in fade-in slide-in-from-top-4 duration-500">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/20 rounded-full animate-pulse">
                            <Radio className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Recover Active Session</CardTitle>
                            <CardDescription className="font-bold text-primary/80">You have airtime remaining from your last paid session. Resume now to avoid wasting points!</CardDescription>
                        </div>
                    </div>
                    <Button asChild size="lg" className="w-full sm:w-auto font-black bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xl shadow-primary/20">
                        <Link href="/dashboard/seller/go-live">
                            GO TO LIVE STUDIO <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Followers</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader><CardContent>{isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-black">{shopData?.followers || 0}</div>}</CardContent></Card>
            <Card className="bg-card/50 border-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Likes</CardTitle><Heart className="h-4 w-4 text-pink-500" /></CardHeader><CardContent>{isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-black">{totalLikes}</div>}</CardContent></Card>
            <Card className="bg-card/50 border-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Views</CardTitle><Eye className="h-4 w-4 text-blue-500" /></CardHeader><CardContent>{isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-black">{totalViews}</div>}</CardContent></Card>
            <Card className="bg-primary/5 border-primary/20"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Earnings</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader><CardContent>{isLoading ? <Skeleton className="h-8 w-1/2"/> : <div className="text-2xl font-black text-primary">${availableBalance.toFixed(2)}</div>}</CardContent></Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button asChild size="lg" className="h-16 font-black rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 text-white tracking-widest uppercase"><Link href="/dashboard/products?tab=add-new">Add Product</Link></Button>
          <Button asChild size="lg" className="h-16 font-black rounded-2xl bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-600/20 text-white tracking-widest uppercase"><Link href="/dashboard/products?tab=add-new">Add Video</Link></Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-headline text-lg font-black uppercase tracking-widest">My Products</h3><Button variant="link" className="text-[10px] font-black uppercase tracking-widest" asChild><Link href="/dashboard/products">Manage All</Link></Button></div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {isLoading ? <><ProductRowSkeleton /><ProductRowSkeleton /></> : products?.map((p) => (
              <AlertDialog key={p.id}>
                  <div className="bg-card/50 p-4 rounded-2xl border border-white/5 flex gap-4 items-center group hover:bg-card hover:border-primary/20 transition-all shadow-sm">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"><Image src={p.imageUrl || "https://picsum.photos/seed/product/80/80"} fill alt="product" className="object-cover" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-sm sm:text-base uppercase tracking-tight truncate">{p.name}</h3>
                      <p className="font-black text-primary text-sm">${p.price?.toLocaleString()}</p>
                      <div className="flex items-center gap-1.5 mt-1.5"><div className={cn("h-1.5 w-1.5 rounded-full", p.stock > 0 ? "bg-green-500" : "bg-red-500")} /><p className={cn("text-[9px] font-black uppercase tracking-tighter", p.stock > 0 ? "text-green-500" : "text-red-500")}>{p.stock > 0 ? 'Active' : 'Out of Stock'}</p></div>
                    </div>
                    <div className="flex items-center gap-2"><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-white/5" onClick={() => { setSelectedProduct(p); setIsEditDialogOpen(true); }}><MoreHorizontal className="h-5 w-5" /></Button><AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500"><X className="h-5 w-5" /></Button></AlertDialogTrigger></div>
                  </div>
                  <AlertDialogContent className="rounded-2xl border-white/10"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tighter">Delete Product?</AlertDialogTitle><AlertDialogDescription className="text-xs font-bold text-muted-foreground uppercase">This will permanently delete "{p.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-red-600 rounded-xl font-black uppercase text-[10px]">Delete Forever</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
          ))}
          </div>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogContent className="sm:max-w-3xl p-0 max-h-[90vh] rounded-3xl overflow-hidden border-white/10"><DialogHeader className="p-6 pb-0 border-b border-white/5 bg-neutral-900/50 backdrop-blur-xl"><DialogTitle className="font-black uppercase tracking-tighter">Edit Product Listing</DialogTitle></DialogHeader><ScrollArea className="h-full"><div className="p-4 sm:p-6 pt-0"><ProductUploadForm productToEdit={selectedProduct} onFormSubmit={() => setIsEditDialogOpen(false)} /></div></ScrollArea></DialogContent></Dialog>
      </div>
    </SellerLayout>
  );
}
