'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Store, UserMinus } from 'lucide-react';
import { collection, doc, getDoc, limit, query, where } from 'firebase/firestore';

import {
  useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile,
} from '@/firebase';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · MY SELLERS.
 *
 * ## What already exists
 *
 * `/api/follow` writes and clears `UserProfile.following: string[]` on the
 * buyer's own document (and maintains `followers` on the seller). Nothing ever
 * read it back — the follow button was write-only. This screen is the read
 * side, which is what turns a list of seller ids into a shopping feed.
 *
 * ## Rules this screen must respect
 *
 * 1. `userProfiles` allows `get` to anyone but `list` only to self, referrer or
 *    admin. So each followed seller is fetched by **document id** with
 *    `getDoc` — never with a `list()` or a collection query. That is the reason
 *    this is an effect over ids rather than a single reactive query.
 * 2. `following` is **optional**. Every buyer created before follows existed has
 *    no such field at all, so `undefined` is the normal case, not an error.
 * 3. `products` permits `read`/`list` to everyone, so the listings query is a
 *    plain `where('sellerId', 'in', …)`. `in` is capped at 10 ids here to stay
 *    inside Firestore's limit and to keep the query indexable.
 */

interface FollowedSeller {
  uid: string;
  fullName?: string;
  username?: string;
  photoURL?: string;
  profilePictureUrl?: string;
  bio?: string;
  followers?: number;
}

/** Firestore's `in` operator accepts at most 10 values. */
const MAX_SELLERS = 10;

export default function BuyerSectionSellers() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { userProfile, isLoading: profileLoading } = useUserProfile(user?.uid);

  const following = React.useMemo<string[]>(() => {
    const raw = (userProfile as { following?: unknown } | null | undefined)?.following;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  }, [userProfile]);

  const sellerIds = React.useMemo(
    () => following.slice(0, MAX_SELLERS),
    [following],
  );

  const [sellers, setSellers] = React.useState<FollowedSeller[]>([]);
  const [sellersLoading, setSellersLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // One `getDoc` per followed seller. `userProfiles` cannot be listed, so this
  // cannot be a reactive query.
  React.useEffect(() => {
    let cancelled = false;
    if (!firestore || sellerIds.length === 0) {
      setSellers([]);
      return () => {
        cancelled = true;
      };
    }

    setSellersLoading(true);
    Promise.all(
      sellerIds.map(async (uid) => {
        const snap = await getDoc(doc(firestore, 'userProfiles', uid)).catch(() => null);
        if (!snap || !snap.exists()) return null;
        // Spread first: the document carries no `uid`, and putting it after
        // would be redundant with the id we already hold.
        const data = snap.data() as Omit<FollowedSeller, 'uid'>;
        return { ...data, uid };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setSellers(results.filter((s): s is FollowedSeller => s !== null));
      })
      .finally(() => {
        if (!cancelled) setSellersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [firestore, sellerIds]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || sellerIds.length === 0) return null;
    return query(
      collection(firestore, 'products'),
      where('sellerId', 'in', sellerIds),
      limit(60),
    );
  }, [firestore, sellerIds]);

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

  const bySeller = React.useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products ?? []) {
      const bucket = map.get(product.sellerId);
      if (bucket) bucket.push(product);
      else map.set(product.sellerId, [product]);
    }
    return map;
  }, [products]);

  const unfollow = async (sellerId: string) => {
    if (!user) return;
    setBusyId(sellerId);
    try {
      const token = await user.getIdToken();
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sellerId, action: 'unfollow' }),
      });
    } catch {
      // Optimistic only: the profile subscription is the source of truth, so a
      // failed request simply leaves the row in place on the next render.
    } finally {
      setBusyId(null);
    }
  };

  const isLoading = profileLoading || sellersLoading || productsLoading;
  const isEmpty = !isLoading && following.length === 0;

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Following"
        title="My sellers"
        action={
          following.length > 0 ? (
            <span className="shrink-0 rounded-full bg-cyan-400/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
              {following.length}
            </span>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3 px-4">
          {[0, 1].map((i) => (
            <div key={i} className="vn-skeleton h-28 w-full rounded-3xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <BuyerEmptyState
          icon={Store}
          title="Not following anyone yet"
          body="Follow a seller and their newest drops collect here, so you never have to hunt for them again."
          action={
            <Link
              href="/app/buyer/shop"
              className="vn-buyer-card px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Browse the feed
            </Link>
          }
        />
      ) : (
        <div className="space-y-4 px-4">
          {following.map((uid) => {
            const seller = sellers.find((s) => s.uid === uid);
            const listings = bySeller.get(uid) ?? [];
            const name = seller?.fullName || seller?.username || 'Seller';
            const avatar = seller?.photoURL || seller?.profilePictureUrl;

            return (
              <section key={uid} className="vn-buyer-card overflow-hidden p-0">
                <div className="flex items-center gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 font-sans text-sm font-bold text-white">
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {name}
                    </span>
                    <span className="block truncate font-sans text-[11px] text-muted-foreground">
                      {seller?.bio
                        ? seller.bio
                        : listings.length > 0
                          ? `${listings.length} listing${listings.length === 1 ? '' : 's'}`
                          : 'No listings yet'}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => unfollow(uid)}
                    disabled={busyId === uid}
                    aria-label={`Unfollow ${name}`}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition',
                      'bg-card ring-1 ring-border text-muted-foreground hover:text-foreground',
                      'disabled:opacity-50',
                    )}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Unfollow
                  </button>
                </div>

                {listings.length > 0 && (
                  // Deliberately NOT links. There is no product detail route
                  // inside `/app/buyer/*` — the only one, `/products/[productId]`,
                  // is a website route, so tapping a tile here would eject the
                  // buyer from the installed app. A tile that does nothing is
                  // better than a tile that breaks the section; these become
                  // links the moment an app-side detail screen exists.
                  <div className="flex gap-2 overflow-x-auto px-4 pb-4">
                    {listings.slice(0, 8).map((product) => (
                      <span key={product.id} className="w-28 shrink-0 space-y-1.5">
                        <span className="relative block aspect-square overflow-hidden rounded-2xl bg-muted">
                          <Image
                            src={
                              product.thumbnailUrls?.[0] ||
                              product.imageUrl ||
                              '/placeholder.svg'
                            }
                            alt={product.name}
                            fill
                            sizes="112px"
                            className="object-cover"
                            unoptimized
                          />
                        </span>
                        <span className="block truncate text-[11px] font-medium text-foreground">
                          {product.name}
                        </span>
                        <span className="block font-sans text-[11px] font-semibold tabular-nums text-cyan-600 dark:text-cyan-300">
                          {product.price.toLocaleString()}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="vn-micro px-4 pb-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Vidnov buyer app · section 2 of 3
      </p>
    </div>
  );
}