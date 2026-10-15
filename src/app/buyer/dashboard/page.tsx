'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/products/product-card';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Search, MapPin, ChevronRight, Radio, LayoutGrid } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, useUserProfile } from '@/firebase';
import { collection, query, limit, where, getDocs } from 'firebase/firestore';
import type { Product, LiveSession, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { RecentOrdersWidget } from '@/components/buyer/recent-orders-widget';
import { RequestMarketplaceCard } from '@/components/buyer/request-marketplace-card';
import { getLocationFromStorage, type UserLocation } from '@/lib/location-detection';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

/* ---------- Small building blocks (Vidnov editorial style) ---------- */

function SectionHeader({
  title,
  href,
  linkLabel = 'View all',
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pb-4 mb-7">
      <h2 className="font-grotesk text-xl md:text-2xl font-bold text-foreground">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition inline-flex items-center gap-1"
        >
          {linkLabel} <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Greeting() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = userProfile?.fullName?.split(' ')[0];

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        {timeGreeting}
      </p>
      <h1 className="font-grotesk text-3xl md:text-4xl font-bold text-foreground mt-3">
        {name ? `Welcome back, ${name}.` : 'Welcome to Vidnov.'}
      </h1>
    </div>
  );
}

const SearchBar = () => (
  <Link href="/search" className="block group">
    <div className="flex items-center gap-4 h-14 rounded-lg border border-border bg-card px-5 vn-transition group-hover:border-foreground/35 group-focus-within:border-foreground">
      <Search className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground font-medium">Search Vidnov…</span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline">
        Products · Businesses · Services
      </span>
    </div>
  </Link>
);

const SellerInfo = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'userProfiles', sellerId) : null),
    [firestore, sellerId],
  );
  const { data: user } = useDoc<UserProfile>(userProfileRef);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-5 w-5 border border-border">
        <AvatarImage src={user?.profilePictureUrl || getPlaceholderImage()} />
        <AvatarFallback className="text-[8px] bg-muted text-foreground">
          {user?.fullName?.charAt(0) || 'S'}
        </AvatarFallback>
      </Avatar>
      <span className="text-[11px] font-medium text-white/80 truncate max-w-[90px]">
        {user?.shopName || user?.fullName || 'Seller'}
      </span>
    </div>
  );
};

const StreamCard = ({ session }: { session: LiveSession }) => (
  <Link href={`/buyer/live/${session.id}`} className="group block">
    <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-card vn-shadow vn-transition group-hover:border-foreground/30">
      <div className="absolute inset-0">
        <Image
          src="/placeholder-image.svg"
          alt={session.title || 'Live stream'}
          fill
          className="object-cover vn-mono-img opacity-80 group-hover:opacity-100 group-hover:scale-[1.03] vn-transition"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-2.5 py-1">
        <span className="vn-dot vn-dot-processing" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white">Live</span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
        <p className="font-grotesk text-xs font-semibold text-white leading-tight line-clamp-2">
          {session.title}
        </p>
        <SellerInfo sellerId={session.sellerId} />
      </div>
    </div>
  </Link>
);

const categoryIconMap: Record<string, string> = {
  'Fashion & Apparel': 'FASHION',
  'Electronics & Gadgets': 'TECH',
  'Home & Living': 'HOME',
  'Beauty & Personal Care': 'BEAUTY',
  'Food & Groceries': 'FOOD',
  'Sports & Outdoors': 'SPORT',
  'Art & Collectibles': 'ART',
  'Books & Stationery': 'BOOKS',
  Other: 'MORE',
};

export default function BuyerDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  useEffect(() => {
    setUserLocation(getLocationFromStorage());
  }, []);

  // Local engine: match detected city to seller target markets
  useEffect(() => {
    const fetchLocalProducts = async () => {
      if (!firestore || !userLocation) {
        setIsLoadingLocal(false);
        return;
      }
      setIsLoadingLocal(true);
      const city = userLocation.city.toUpperCase();
      try {
        const shopsQuery = query(
          collection(firestore, 'sellerShops'),
          where('targetLocations', 'array-contains', city),
        );
        const shopsSnap = await getDocs(shopsQuery);
        const targetSellerIds = shopsSnap.docs.map((d) => d.id);

        const productsQuery = query(collection(firestore, 'products'), limit(30));
        const productsSnap = await getDocs(productsQuery);
        const allFetched = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));

        const matched = allFetched.filter(
          (p) =>
            targetSellerIds.includes(p.sellerId) ||
            (p.location && p.location.toUpperCase().includes(city)),
        );
        setLocalProducts(matched.slice(0, 10));
      } catch (err) {
        console.error('Local engine failed:', err);
      } finally {
        setIsLoadingLocal(false);
      }
    };
    fetchLocalProducts();
  }, [firestore, userLocation]);

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'), limit(10));
  }, [firestore]);

  const dealsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'), where('wasPrice', '>', 0), limit(10));
  }, [firestore]);

  const pendingOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.uid),
      where('orderStatus', '==', 'pending'),
      limit(1),
    );
  }, [firestore, user]);

  const { data: liveSessions } = useCollection<LiveSession>(liveSessionsQuery);
  const { data: dealsProducts, isLoading: isLoadingDeals } = useCollection<Product>(dealsQuery);
  const { data: pendingOrders } = useCollection<Order>(pendingOrdersQuery);

  const hasPendingPayment = pendingOrders && pendingOrders.length > 0;

  return (
    <BuyerLayout>
      <div className="vn-page-enter space-y-12 md:space-y-16 pb-10">
        {/* Welcome + search */}
        <section className="space-y-7">
          <Greeting />
          <SearchBar />

          {hasPendingPayment && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-accent/40 bg-accent/5 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                  Payment awaiting
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have a pending order for &ldquo;{pendingOrders[0].productName}&rdquo;. Complete payment to start delivery.
                </p>
              </div>
              <Button asChild className="h-11 px-6 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em] shrink-0">
                <Link href={`/checkout/${pendingOrders[0].id}`}>Complete payment</Link>
              </Button>
            </div>
          )}
        </section>

        {/* Request Marketplace — the buyer side of the matching engine */}
        <RequestMarketplaceCard />

        {/* Near you */}
        <section>
          <SectionHeader title={`Near you${userLocation?.city ? ` — ${userLocation.city}` : ''}`} />
          {isLoadingLocal ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="vn-skeleton aspect-[4/5] rounded-lg" />
                  <Skeleton className="vn-skeleton h-3 w-3/4" />
                  <Skeleton className="vn-skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : localProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {localProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="font-grotesk text-base font-semibold text-foreground">No nearby sellers yet</p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
                Businesses in your area are joining Vidnov every day. Explore the full marketplace meanwhile.
              </p>
              <Button asChild variant="outline" className="mt-6 h-11 px-8 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em]">
                <Link href="/search">Explore everything</Link>
              </Button>
            </div>
          )}
        </section>

        {/* Discover — live now */}
        {liveSessions && liveSessions.length > 0 && (
          <section>
            <SectionHeader title="Discover — live now" href="/live" linkLabel="All streams" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {liveSessions.map((session) => (
                <StreamCard key={session.id} session={session} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section>
          <SectionHeader title="Browse categories" href="/categories" />
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {PRODUCT_CATEGORIES.slice(0, 9).map((cat) => (
              <Link
                key={cat}
                href={`/search?q=${encodeURIComponent(cat)}`}
                className="group rounded-lg border border-border bg-card p-4 flex flex-col items-center justify-center gap-3 vn-transition hover:border-foreground/40 hover:bg-secondary"
              >
                <span className="font-grotesk text-[10px] font-semibold tracking-[0.18em] text-muted-foreground group-hover:text-foreground text-center leading-tight">
                  {categoryIconMap[cat] || cat.split(' ')[0].toUpperCase()}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Deals */}
        <section>
          <SectionHeader title="Today's deals" />
          {isLoadingDeals ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="vn-skeleton aspect-[4/5] rounded-lg" />
              ))}
            </div>
          ) : dealsProducts && dealsProducts.length > 0 ? (
            <Carousel opts={{ align: 'start' }} className="w-full">
              <CarouselContent className="-ml-4">
                {dealsProducts.map((product) => (
                  <CarouselItem key={product.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 pl-4">
                    <ProductCard product={product} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden lg:flex" />
              <CarouselNext className="hidden lg:flex" />
            </Carousel>
          ) : (
            <p className="text-xs text-muted-foreground py-8">No active deals right now — check back soon.</p>
          )}
        </section>

        {/* Recent orders + delivery tracking */}
        <RecentOrdersWidget />

        {/* Mobile quick links (bottom-nav complement) */}
        <section className="lg:hidden">
          <SectionHeader title="Your account" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'My Orders', href: '/buyer/my-orders' },
              { label: 'Saved Items', href: '/buyer/wishlist' },
              { label: 'Wallet & Payments', href: '/buyer/wallet' },
              { label: 'My Media', href: '/buyer/media' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-border bg-card px-5 py-4 flex items-center justify-between vn-transition hover:border-foreground/35"
              >
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </BuyerLayout>
  );
}
