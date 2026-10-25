'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { DiscoverySection } from '@/components/discovery/discovery-section';
import type { DiscoveryNavItem } from '@/components/discovery/discovery-nav';
import { Sparkles, ShoppingBag, BriefcaseBusiness, Store, MapPin, Radio } from 'lucide-react';
import type { DiscoveryCategoryId } from '@/lib/discovery';

export function LiveFeedContent({
  backHref,
  chrome = true,
  surface = 'buyer',
  className,
}: {
  backHref: string;
  chrome?: boolean;
  surface?: 'buyer' | 'seller';
  className?: string;
}) {
  const firestore = useFirestore();

  const nav: DiscoveryNavItem[] = [
    { key: 'for-you', label: 'For You', href: '/buyer/discovery', icon: Sparkles },
    { key: 'products', label: 'Products', href: '/buyer/discovery?category=products', icon: ShoppingBag },
    { key: 'services', label: 'Services', href: '/buyer/discovery?category=services', icon: BriefcaseBusiness },
    { key: 'businesses', label: 'Businesses', href: '/buyer/discovery?category=businesses', icon: Store },
    { key: 'nearby', label: 'Nearby', href: '/buyer/discovery?category=nearby', icon: MapPin },
    { key: 'live', label: 'Live', href: '/buyer/discovery?category=live', icon: Radio },
  ];

  if (!firestore) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">Loading the feed</p>
      </div>
    );
  }

  /*
   * `fill`, not the default 100dvh: this feed renders INSIDE SellerLayout,
   * below its header. A 100dvh section there starts under the header, so its
   * bottom — the product card and its View product button — sat one
   * header-height below the fold and was clipped off the screen.
   */
  return <DiscoverySection nav={nav} noBottomNav fill />;
}
