'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search as SearchIcon, Store, ShoppingBag } from 'lucide-react';
import { ProductGrid } from '@/components/products/product-grid';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { SearchProductDoc, SellerSearchDoc } from '@/lib/vidnov-core/catalog/search';
import type { Product, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Search runs SERVER-SIDE against GET /api/search (validated + bounded:
 * ≤200-char query, ≤50 results, capped candidate window). This page no longer
 * downloads the whole `products` collection to filter in the browser.
 *
 * Failure handling is bounded and non-destructive: exactly ONE automatic
 * retry (800 ms, abortable) for a network error or a 5xx, never for a 4xx;
 * after that a plain error state with a manual retry button. A failed search
 * never blocks navigating to a product or shop.
 */

const RESULT_LIMIT = 32;

interface SearchState {
  products: Product[];
  sellers: UserProfile[];
  /** True when the server hit its scan window — results may be partial. */
  windowCapped: boolean;
}

function toState(body: Record<string, unknown>): SearchState {
  // The server returns an explicit public projection of the same documents;
  // every field the product/seller cards render is included by the API.
  const products = Array.isArray(body.products) ? (body.products as SearchProductDoc[]) : [];
  const sellers = Array.isArray(body.sellers) ? (body.sellers as SellerSearchDoc[]) : [];
  return {
    products: products as unknown as Product[],
    sellers: sellers as unknown as UserProfile[],
    windowCapped: body.windowCapped === true,
  };
}

function SearchResults() {
    const searchParams = useSearchParams();
    const queryTerm = (searchParams?.get('q') ?? '').trim();

    const [result, setResult] = useState<SearchState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0); // manual retry bumps this

    useEffect(() => {
      const controller = new AbortController();
      let cancelled = false;
      let retries = 0;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;

      const load = async () => {
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(queryTerm)}&limit=${RESULT_LIMIT}`,
            { signal: controller.signal },
          );
          if (!res.ok) {
            const clientError = res.status >= 400 && res.status < 500;
            if (!clientError && retries < 1) {
              retries += 1;
              retryTimer = setTimeout(load, 800);
              return;
            }
            throw new Error('search_failed');
          }
          const body = (await res.json()) as Record<string, unknown>;
          if (cancelled) return;
          setResult(toState(body));
          setFailed(false);
          setIsLoading(false);
        } catch {
          if (cancelled || controller.signal.aborted) return;
          if (retries < 1) {
            retries += 1;
            retryTimer = setTimeout(load, 800);
            return;
          }
          setFailed(true);
          setIsLoading(false);
        }
      };

      setIsLoading(true);
      load();

      return () => {
        cancelled = true;
        controller.abort();
        if (retryTimer) clearTimeout(retryTimer);
      };
    }, [queryTerm, attempt]);

    const products = result?.products ?? [];
    const sellers = result?.sellers ?? [];

    if (isLoading) {
        return (
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (failed) {
        return (
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-neutral-900/20 border-neutral-800">
                    <SearchIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold text-white">Search is unavailable</h3>
                    <p className="text-muted-foreground mb-4">Please try again in a moment.</p>
                    <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
            <div className="flex items-center gap-2">
                <SearchIcon className="h-6 w-6 text-primary" />
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    {queryTerm ? `Results for "${queryTerm}"` : "Explore Everything"}
                </h1>
            </div>

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList className="bg-neutral-900 border-neutral-800">
                    <TabsTrigger value="products" className="data-[state=active]:bg-primary">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Products ({products.length})
                    </TabsTrigger>
                    <TabsTrigger value="sellers" className="data-[state=active]:bg-primary">
                        <Store className="mr-2 h-4 w-4" />
                        Sellers ({sellers.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-4 pt-4">
                    {products.length > 0 ? (
                        <>
                            <ProductGrid products={products} />
                            {(result?.windowCapped || products.length >= RESULT_LIMIT) && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Showing the top {products.length} matches — refine your search to narrow it down.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-neutral-900/20 border-neutral-800">
                            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-white">No products found</h3>
                            <p className="text-muted-foreground">Try a different keyword or category.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="sellers" className="pt-4">
                    {sellers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sellers.map(seller => (
                                <Card key={seller.id} className="hover:bg-neutral-900 transition-colors border-neutral-800 bg-neutral-950">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-primary">
                                                <AvatarImage src={seller.profilePictureUrl} />
                                                <AvatarFallback>{seller.fullName?.charAt(0) || seller.username?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-bold truncate text-lg text-white">{seller.shopName || seller.fullName}</p>
                                                <p className="text-xs text-muted-foreground truncate">@{seller.username}</p>
                                                <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                                                    <Link href={`/sellers/${seller.id}`}>Visit</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-neutral-900/20 border-neutral-800">
                            <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-white">No sellers found</h3>
                            <p className="text-muted-foreground">We couldn't find any shops matching your search.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function SearchPage() {
  // Guests may search: the catalogue is public and the endpoint reads it
  // server-side, so there is no permission error to gate around any more.
  return (
    <BuyerLayout isGuestAllowed>
      <Suspense fallback={<div className="p-8 text-white">Loading Search...</div>}>
        <SearchResults />
      </Suspense>
    </BuyerLayout>
  );
}
