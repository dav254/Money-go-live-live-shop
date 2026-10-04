'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Search } from 'lucide-react';
import { useAuth } from '@/firebase';
import { SellerCard, SellerSectionTitle } from '@/components/app/seller/seller-app-shell';
import { CustomerLocationPicker } from '@/components/locations/customer-location-picker';
import { ListingThumb } from '@/components/app/seller/listing-thumb';
import { VerificationBadge } from '@/components/trust/verification-badge';
import { TierBadge } from '@/components/trust/tier-badge';
import type { AccountTier } from '@/lib/tiers';
import { RADIUS_PRESETS_KM } from '@/lib/locations/hierarchy';
import { formatDistance } from '@/lib/business/location';
import type { CustomerLocation } from '@/lib/locations/customer';

/**
 * NEARBY — "find what I need around me".
 *
 * ## Why the location control is the first thing on the screen
 *
 * Not a dialog, not a banner. Without a location this page has nothing to show,
 * and a marketplace that opens on an empty screen and asks a question afterwards
 * teaches people to close it. So the control is the page.
 *
 * ## The empty state is the growth engine
 *
 * "No businesses in Westlands yet" is a failure for one customer and a
 * recruitment surface for the next seller. That is the same 'don't limit anyone'
 * principle already applied to listings and video: the gap is where supply gets
 * recruited, not where the product gives up.
 */

interface NearbyBusiness {
  id: string;
  name: string;
  slug?: string;
  kind?: string;
  category?: string;
  verificationStatus?: any;
  /** Automatic tier from delivered orders. Absent on older payloads. */
  tier?: AccountTier | null;
  completedTransactions?: number;
  approximateLocation?: string;
  distanceKm?: number | null;
}

interface NearbyListing {
  id: string;
  title?: string;
  price?: number;
  imageUrl?: string;
  businessId?: string;
}

export default function BuyerNearbyPage() {
  const auth = useAuth();
  const [location, setLocation] = React.useState<CustomerLocation | null>(null);
  const [needsLocation, setNeedsLocation] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [yourArea, setYourArea] = React.useState('');
  const [radius, setRadius] = React.useState<string>('');
  const [query, setQuery] = React.useState('');
  const [businesses, setBusinesses] = React.useState<NearbyBusiness[]>([]);
  const [listings, setListings] = React.useState<NearbyListing[]>([]);

  const load = React.useCallback(
    async (radiusKm?: string) => {
      const current = auth?.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await current.getIdToken();
        const qs = radiusKm ? `?radiusKm=${encodeURIComponent(radiusKm)}` : '';
        const res = await fetch(`/api/nearby${qs}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setNeedsLocation(!!json.needsLocation);
        setYourArea(json.yourArea || '');
        setBusinesses(Array.isArray(json.businesses) ? json.businesses : []);
        setListings(Array.isArray(json.listings) ? json.listings : []);
      } catch {
        /* the empty state covers a failed load */
      } finally {
        setLoading(false);
      }
    },
    [auth],
  );

  React.useEffect(() => {
    (async () => {
      const current = auth?.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }
      try {
        const token = await current.getIdToken();
        const res = await fetch('/api/me/location', {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        setLocation((json?.location ?? null) as CustomerLocation | null);
      } catch {
        /* fall through to the picker */
      }
      await load();
    })();
  }, [auth, load]);

  const visibleBusinesses = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) =>
      `${b.name} ${b.category ?? ''} ${b.kind ?? ''}`.toLowerCase().includes(q),
    );
  }, [businesses, query]);

  // The website's own Nearby screen, so the feature is reachable from both
  // surfaces without anyone hunting for a URL.
  const websiteNearbyHref = '/buyer/nearby';

  const visibleListings = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => `${l.title ?? ''}`.toLowerCase().includes(q));
  }, [listings, query]);

  return (
    <div className="vn-page-enter space-y-4 pb-4">
      <SellerSectionTitle eyebrow="Around you" title="Nearby" />

      <SellerCard>
        <CustomerLocationPicker
          location={location}
          onLocationChange={(next) => {
            setLocation(next);
            void load(radius);
          }}
        />
      </SellerCard>

      {!needsLocation && (
        <>
          <div className="px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="w-full rounded-xl border border-border bg-card py-3 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>

          <div className="px-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setRadius('');
                  void load('');
                }}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  radius === ''
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                Any distance
              </button>
              {RADIUS_PRESETS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => {
                    setRadius(String(km));
                    void load(String(km));
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    radius === String(km)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  Within {km} km
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : needsLocation ? (
        <div className="px-4">
          <SellerCard>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Set your area above and we will show businesses and listings around
              you. We never show your location to a seller.
            </p>
          </SellerCard>
        </div>
      ) : visibleBusinesses.length === 0 && visibleListings.length === 0 ? (
        <div className="px-4">
          <SellerCard>
            <MapPin className="h-5 w-5 text-primary" />
            <p className="font-grotesk mt-3 text-sm font-semibold text-foreground">
              Nothing nearby in {yourArea} yet
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {query
                ? 'Nothing matches that search here. Try a different word.'
                : 'Be the first business here. Anyone selling in this area will find these customers waiting.'}
            </p>
        {!query && (
          <Link
            href="/app/buyer/requests"
            className="mt-3 inline-block text-xs font-semibold text-primary underline"
          >
            Post what you need instead
          </Link>
        )}
        <Link
          href={websiteNearbyHref}
          className="mt-2 ml-3 inline-block text-[11px] text-muted-foreground underline"
        >
          Open Nearby on the web
        </Link>
          </SellerCard>
        </div>
      ) : (
        <>
          {visibleBusinesses.length > 0 && (
            <div className="space-y-3 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Businesses
              </p>
              {visibleBusinesses.map((b) => (
                <SellerCard key={b.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-grotesk text-sm font-semibold text-foreground">
                        {b.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {b.approximateLocation || 'Location not published'}
                      </p>
                    </div>
                    {typeof b.distanceKm === 'number' && (
                      <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDistance(b.distanceKm)}
                      </span>
                    )}
                  </div>
                  {(b.verificationStatus || b.tier) && (
                    /* Two trust marks, different sources: the tick is a person
                       who checked documents, the tier is arithmetic over
                       delivered orders. Shown together so neither is mistaken
                       for the other. */
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {b.verificationStatus && <VerificationBadge status={b.verificationStatus} />}
                      <TierBadge tier={b.tier} />
                    </div>
                  )}
                </SellerCard>
              ))}
            </div>
          )}

          {visibleListings.length > 0 && (
            <div className="space-y-3 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Listings near you
              </p>
              <div className="grid grid-cols-2 gap-3">
                {visibleListings.map((l) => (
                  <Link
                    key={l.id}
                    href={`/app/buyer/product/${l.id}`}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
                  >
                    <ListingThumb src={l.imageUrl} alt={l.title || 'Listing'} className="aspect-square w-full" />
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-medium text-foreground">{l.title}</p>
                      {typeof l.price === 'number' && (
                        <p className="mt-1 text-xs font-bold text-primary">
                          KES {l.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
