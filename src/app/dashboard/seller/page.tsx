'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, useUserProfile } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Clock, MessageSquare, Plus, Clapperboard, Sparkles, Tag, MoreHorizontal, X } from 'lucide-react';
import type { SellerShop, Product, Order, Payout } from '@/lib/types';
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
import { addDays } from 'date-fns';
import { mirrorProductDelete } from '@/lib/products/mirror';
import { RequestsTeaser } from '@/components/seller/requests-teaser';
import { RecentOrdersWidget } from '@/components/seller/recent-orders-widget';
import { AnalyticsSnapshot } from '@/components/seller/analytics-snapshot';
import { StockAlerts } from '@/components/seller/stock-alerts';

const ProductRowSkeleton = () => (
  <div className="flex gap-4 items-center py-4 border-b border-border">
    <Skeleton className="vn-skeleton w-16 h-16 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="vn-skeleton h-4 w-3/4" />
      <Skeleton className="vn-skeleton h-3 w-1/4" />
    </div>
  </div>
);

export default function SellerDashboardPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | undefined>(undefined);

  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const sellerShopRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `sellerShops/${user.uid}`);
  }, [firestore, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const payoutsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'payouts'),
      where('sellerId', '==', user.uid),
      where('status', '==', 'completed'),
    );
  }, [firestore, user]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: payouts, isLoading: arePayoutsLoading } = useCollection<Payout>(payoutsQuery);

  const isLoading =
    isUserLoading || isShopLoading || areProductsLoading || areOrdersLoading || arePayoutsLoading || isProfileLoading;

  const { totalLikes, totalViews, availableBalance, newOrders, pendingOrdersCount } = React.useMemo(() => {
    const likes = products?.reduce((sum, product) => sum + (product.likes || 0), 0) || 0;
    const views = products?.reduce((sum, product) => sum + (product.viewCount || 0), 0) || 0;
    const completedOrders = orders?.filter((o) => o.orderStatus === 'delivered' || o.orderStatus === 'shipped') || [];
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const balance = totalRevenue * 0.9 - (payouts?.reduce((sum, p) => sum + p.amount, 0) || 0);
    const newOrders = orders?.filter((o) => o.orderStatus === 'pending').length || 0;
    const pendingOrdersCount = orders?.filter((o) => o.orderStatus === 'processing').length || 0;
    return { totalLikes: likes, totalViews: views, availableBalance: balance, newOrders, pendingOrdersCount };
  }, [products, orders, payouts]);

  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'products', productId));
      mirrorProductDelete(user, productId);
      toast({ title: 'Product deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error' });
    }
  };

  const welcomeBonusDaysLeft = React.useMemo(() => {
    if (!userProfile?.freePointsAwardedAt) return null;
    const awardedAt = new Date(userProfile.freePointsAwardedAt);
    const expiry = addDays(awardedAt, 30);
    const now = new Date();
    if (now > expiry) return 0;
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }, [userProfile]);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  return (
    <SellerLayout>
      <div className="vn-page-enter p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            {timeGreeting} — VIDNOV BUSINESS
          </p>
          <h1 className="font-grotesk text-3xl md:text-4xl font-bold text-foreground">
            {shopData?.shopName || 'Your Business'}
          </h1>
        </div>

        {welcomeBonusDaysLeft !== null && welcomeBonusDaysLeft > 0 && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Welcome bonus active
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              You have <span className="text-foreground font-semibold">{(userProfile?.aiPoints || 0).toLocaleString()} AI points</span> remaining.
              Expires in <span className="text-foreground font-semibold">{welcomeBonusDaysLeft} days</span>. Use them to create product media in AI Studio.
            </p>
          </div>
        )}

        {/* Business overview — oversized numbers */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-6">
            BUSINESS OVERVIEW
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
            {[
              { label: 'SALES', value: `$${availableBalance.toFixed(0)}`, accent: true },
              { label: 'ORDERS', value: String(orders?.length ?? '—') },
              { label: 'CUSTOMERS', value: String(shopData?.followers ?? '—') },
              { label: 'PRODUCT VIEWS', value: String(totalViews) },
            ].map((stat) => (
              <div key={stat.label} className="bg-card p-6 lg:p-8">
                <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{stat.label}</p>
                {isLoading ? (
                  <Skeleton className="vn-skeleton h-10 w-24 mt-3" />
                ) : (
                  <p className={cn(
                    'font-grotesk text-3xl lg:text-4xl font-bold mt-3 tabular-nums',
                    stat.accent ? 'text-foreground' : 'text-foreground',
                  )}>
                    {stat.value}
                  </p>
                )}
                {stat.accent && !isLoading && (
                  <span className="inline-block h-1 w-8 bg-accent mt-3" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Inventory attention — hidden when every product is healthy */}
        <StockAlerts products={products} isLoading={areProductsLoading} />

        {/* Today */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-5">TODAY</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Package, label: 'New orders', value: newOrders, href: '/dashboard/seller/orders' },
              { icon: Clock, label: 'Processing', value: pendingOrdersCount, href: '/dashboard/seller/orders' },
              { icon: MessageSquare, label: 'Messages', value: null, href: '/messages' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group rounded-lg border border-border bg-card px-5 py-4 flex items-center justify-between vn-transition hover:border-foreground/35"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </span>
                {item.value !== null ? (
                  <span className="font-grotesk text-lg font-bold tabular-nums">{item.value}</span>
                ) : (
                  <span className="vn-dot vn-dot-pending" />
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-5">QUICK ACTIONS</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Plus, label: 'Add Product', href: '/dashboard/products?tab=add-new' },
              { icon: Clapperboard, label: 'Create AI Ad', href: '/dashboard/seller/ai-studio' },
              { icon: Tag, label: 'Create Offer', href: '/dashboard/seller/marketing' },
              { icon: Sparkles, label: 'AI Studio', href: '/dashboard/seller/ai-studio' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group rounded-lg border border-border bg-card p-5 flex flex-col items-start gap-6 vn-transition hover:border-foreground/40 hover:bg-secondary"
              >
                <action.icon className="h-5 w-5 text-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-foreground">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Performance — revenue trend, orders, average order value, conversion */}
        <AnalyticsSnapshot orders={orders} products={products} isLoading={areOrdersLoading || areProductsLoading} />

        {/* Recent orders with inline status actions */}
        <RecentOrdersWidget orders={orders} isLoading={areOrdersLoading} />

        {/* Customer requests — the matching-engine inbox */}
        <RequestsTeaser />
        

        {/* Products */}

        {/* Products */}
        <section>
          <div className="flex items-baseline justify-between border-b border-border pb-4 mb-2">
            <h2 className="font-grotesk text-xl font-bold text-foreground">My Products</h2>
            <Link
              href="/dashboard/products"
              className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition"
            >
              Manage all
            </Link>
          </div>

          {isLoading ? (
            <ProductRowSkeleton />
          ) : products && products.length > 0 ? (
            <div>
              {products.slice(0, 6).map((p) => (
                <AlertDialog key={p.id}>
                  <div className="flex gap-4 items-center py-4 border-b border-border group">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                      <Image
                        src={p.imageUrl || 'https://placehold.co/80x80/141414/FFFFFF?text=—'}
                        fill
                        alt={p.name || 'Product image'}
                        className="object-cover vn-mono-img"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                      <p className="font-grotesk text-sm font-bold text-foreground mt-0.5">${p.price?.toLocaleString()}</p>
                      <p className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                        <span className={cn('vn-dot', p.stock > 0 ? 'vn-dot-completed' : 'vn-dot-failed')} />
                        <span className={p.stock > 0 ? 'text-muted-foreground' : 'text-destructive'}>
                          {p.stock > 0 ? 'Active' : 'Out of stock'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-lg"
                        onClick={() => {
                          setSelectedProduct(p);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg text-destructive hover:text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </div>
                  </div>
                  <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-grotesk">Delete product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &ldquo;{p.name}&rdquo;. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(p.id)}
                        className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <p className="font-grotesk text-lg font-semibold text-foreground">No products yet</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Add your first product to start selling on Vidnov. Video listings sell faster.
              </p>
              <Button asChild className="mt-7 h-12 px-8 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em]">
                <Link href="/dashboard/products?tab=add-new">Add product</Link>
              </Button>
            </div>
          )}
        </section>

        {/* Edit dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-3xl p-0 max-h-[90vh] rounded-xl overflow-hidden border-border">
            <DialogHeader className="p-6 pb-4 border-b border-border">
              <DialogTitle className="font-grotesk text-lg">Edit product</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-6 pt-0">
                <ProductUploadForm productToEdit={selectedProduct} onFormSubmit={() => setIsEditDialogOpen(false)} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );
}
