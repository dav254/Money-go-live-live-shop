'use client';

import * as React from 'react';
import Link from 'next/link';
import { Boxes, Pencil, Plus, X } from 'lucide-react';
import { collection, deleteDoc, doc, query, where } from 'firebase/firestore';
import {
  useCollection, useFirestore, useMemoFirebase, useUser,
} from '@/firebase';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import {
  EmptyState, SellerCard, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';
import { ListingThumb } from '@/components/app/seller/listing-thumb';
import { mirrorProductDelete } from '@/lib/products/mirror';

/**
 * SELLER APP · STOCK.
 *
 * Clone of the website's product management (the "My Products" list on
 * `/dashboard/seller` plus `/dashboard/products`), rebuilt as a stacked card
 * list with the section's own controls. Editing opens the very same
 * `ProductUploadForm` the website uses, so behaviour is identical while the
 * presentation belongs only to this section.
 */

type StockFilter = 'all' | 'in' | 'out';

const FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In stock' },
  { key: 'out', label: 'Out' },
];

export default function SellerSectionStock() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [filter, setFilter] = React.useState<StockFilter>('all');
  const [editing, setEditing] = React.useState<Product | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  /*
   * Listings that exist only in the VPS store (their Firestore write failed,
   * or Firestore is unreachable right now) still have to show up here — the
   * server returns them and we merge them in, deduped by id. A seller must
   * never see their own stock as EMPTY because Firestore is down.
   */
  const [vpsProducts, setVpsProducts] = React.useState<Product[]>([]);
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/products/mine', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data?.products)) setVpsProducts(data.products);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const allProducts = React.useMemo(() => {
    const fsRows = products ?? [];
    const seen = new Set(fsRows.map((p) => p.id));
    return [...fsRows, ...vpsProducts.filter((p) => !seen.has(p.id))];
  }, [products, vpsProducts]);

  /*
   * The quota is the seller's TOTAL across every listing, so it cannot be
   * summed from the `products` this screen already has — it is counted by the
   * server (`/api/listings/quota`) and read once on mount. Shown up front so a
   * seller is never surprised by a refusal at the moment they hit publish.
   */
  const [quota, setQuota] = React.useState<{ used: number; quota: number; full: boolean } | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/listings/quota', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { used: number; quota: number; full: boolean };
        if (alive) setQuota(data);
      } catch {
        /* Leave the banner hidden rather than blocking the screen over a
           counter that failed — the publish path re-checks anyway. */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const visible = React.useMemo(() => {
    const all = allProducts;
    if (filter === 'in') return all.filter((p) => p.stock > 0);
    if (filter === 'out') return all.filter((p) => p.stock === 0);
    return all;
  }, [allProducts, filter]);

  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'products', productId));
      mirrorProductDelete(user, productId);
      toast({ title: 'Product deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete that product' });
    }
  };

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle
        eyebrow="Inventory"
        title="Your stock"
        action={
          <Link
            href="/app/seller/create"
            className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Link>
        }
      />

      {quota && (
        <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Media used
            </span>
            <span
              className={cn(
                'text-[10px] font-black uppercase tracking-widest',
                quota.full ? 'text-red-400' : quota.used / quota.quota > 0.8 ? 'text-amber-400' : 'text-cyan-400',
              )}
            >
              {quota.used} / {quota.quota}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                quota.full ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-violet-500',
              )}
              style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.quota)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {quota.full
              ? `You have used all ${quota.quota} media items. Delete an item you no longer need, or upgrade for more space.`
              : `${quota.quota - quota.used} left. Photos and videos both count.`}
          </p>
        </div>
      )}

      {/* Filter chips — the app stacks cards, so filtering replaces the
          website's table header controls. */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition',
              filter === chip.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {chip.label}
            {chip.key === 'all' ? ` (${allProducts.length})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2.5 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vn-skeleton h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={filter === 'all' ? 'No products yet' : 'Nothing in this filter'}
          body={
            filter === 'all'
              ? 'Add your first product to start selling on Vidnov. Video listings sell faster.'
              : 'Switch the filter, or add a new listing to fill this shelf.'
          }
          action={
            <Link
              href="/app/seller/create"
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Add product
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5 px-4">
          {visible.map((product) => (
            <SellerCard
              key={product.id}
              className="vn-app-card flex items-center gap-3 p-3"
            >
              <ListingThumb
                src={product.imageUrl}
                alt={product.name || 'Product image'}
                className="h-16 w-16 shrink-0 rounded-xl border border-border"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {product.name}
                </p>
                <p className="font-grotesk mt-0.5 text-sm font-bold tabular-nums text-foreground">
                  ${product.price?.toLocaleString()}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      product.stock > 0
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/12 text-red-600 dark:text-red-400',
                    )}
                  >
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {product.viewCount ?? 0} views · {product.likes ?? 0} likes
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Edit ${product.name}`}
                  onClick={() => {
                    setEditing(product);
                    setIsEditOpen(true);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Delete ${product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-grotesk">Delete product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &ldquo;{product.name}&rdquo;. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(product.id)}
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SellerCard>
          ))}
        </div>
      )}

      {/* Edit — the same form the website uses, presented in this section. */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border-border p-0">
          <DialogHeader className="border-b border-border p-5 pb-4">
            <DialogTitle className="font-grotesk text-lg">Edit product</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-full">
            <div className="p-4 pt-0">
              <ProductUploadForm
                productToEdit={editing}
                onFormSubmit={() => setIsEditOpen(false)}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <div className="px-4">
        <Button
          asChild
          variant="outline"
          className="w-full rounded-xl border-border bg-transparent"
        >
          <Link href="/app/seller/create">
            <Plus className="mr-2 h-4 w-4" />
            Add another product
          </Link>
        </Button>
      </div>
    </div>
  );
}
