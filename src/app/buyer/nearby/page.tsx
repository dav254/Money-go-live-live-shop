'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Search } from 'lucide-react';
import { BuyerLayout } from '@/components/buyer/buyer-layout';
import { CustomerLocationPicker } from '@/components/locations/customer-location-picker';
import { BusinessTrustPanel } from '@/components/trust/business-trust-panel';
import { RADIUS_PRESETS_KM } from '@/lib/locations/hierarchy';
import type { CustomerLocation } from '@/lib/locations/customer';
import { useUser } from '@/firebase';

/**
 * NEARBY — on the website.
 *
 * ## The same feature, not a second one
 *
 * This page and `/app/buyer/nearby` are the same idea in two chromes, and the
 * duplication is deliberate and cheap: both mount the same
 * `CustomerLocationPicker`, both call the same `/api/nearby`, and both render
 * `BusinessTrustPanel`. What differs is the frame around it — phone tab bar
 * versus desktop header — and nothing about how the location is obtained or how
 * a result is decided.
 *
 * That matters because the alternative is what the reviews were: two systems
 * where only one of them is reachable, and nobody notices until the numbers
 * disagree. Here there is exactly one place coordinates are captured, one
 * endpoint that reads them, and one component that renders a business's trust
 * signals.
 */

interface NearbyBusiness {
  id: string;
  /** Seller uid — what the public trust endpoint is keyed by. */
  sellerId?: string;
  name: string;
  category?: string;
  verificationStatus?: string | null;
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

export default function BuyerNearbyWebPage() {
  const { user } = useUser();
  const [location, setLocation] = React.useState<CustomerLocation | null>(null);
  const [needsLocation, setNeedsLocation] = React.useState(true);
  const [yourArea, setYourArea] = React.useState('');
  const [radius, setRadius] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [businesses, setBusinesses] = React.useState<NearbyBusiness[]>([]);
  const [listings, setListings] = React.useState<NearbyListing[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(
    async (radiusKm?: string) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/nearby${radiusKm ? `?radiusKm=${encodeURIComponent(radiusKm)}` : ''}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setNeedsLocation(!!json.needsLocation);
        setYourArea(json.yourArea || '');
        setBusinesses(Array.isArray(json.businesses) ? json.businesses : []);
        setListings(Array.isArray(json.listings) ? json.listings : []);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  React.useEffect(() => {
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/me/location', { headers: { authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        setLocation((json?.location ?? null) as CustomerLocation | null);
      } catch {
        /* the picker covers it */
      }
      await load();
    })();
  }, [user, load]);

  const q = query.trim().toLowerCase();
  const shownBusinesses = q
    ? businesses.filter((b) => `${b.name} ${b.category ?? ''}`.toLowerCase().includes(q))
    : businesses;
  const shownListings = q
    ? listings.filter((l) => `${l.title ?? ''}`.toLowerCase().includes(q))
    : listings;

  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-6xl py-10">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">Around you</p>
          <h1 className="font-headline mt-2 text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
            Nearby
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Products and services available around you. We never show your location to a
            seller.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
              <CustomerLocationPicker
                location={location}
                onLocationChange={(next) => {
                  setLocation(next);
                  void load(radius);
                }}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : needsLocation ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Set your area on the left and we will show what is near you.
                </p>
              </div>
            ) : shownBusinesses.length === 0 && shownListings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <MapPin className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-3 font-black uppercase tracking-widest text-white">
                  Nothing nearby in {yourArea} yet
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  {q
                    ? 'Nothing matches that search here. Try a different word.'
                    : 'Be the first business here. Anyone selling in this area finds these customers waiting.'}
                </p>
                {!q && (
                  <Link href="/buyer/post-request" className="mt-4 inline-block text-sm font-bold text-primary underline">
                    Post what you need instead
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Phone repair, photographer, cake, shoes…"
                    className="w-full rounded-xl border border-white/10 bg-neutral-900/50 py-3 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setRadius(''); void load(''); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      radius === '' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground'
                    }`}
                  >
                    Any distance
                  </button>
                  {RADIUS_PRESETS_KM.map((km) => (
                    <button
                      key={km}
                      onClick={() => { setRadius(String(km)); void load(String(km)); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        radius === String(km) ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground'
                      }`}
                    >
                      Within {km} km
                    </button>
                  ))}
                </div>

                {shownBusinesses.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {shownBusinesses.map((b) => (
                      <div key={b.id} className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-headline truncate text-lg font-black uppercase tracking-tight text-white">
                              {b.name}
                            </p>
                            {b.category && (
                              <p className="text-xs text-muted-foreground">{b.category}</p>
                            )}
                          </div>
                          {typeof b.distanceKm === 'number' && (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400">
                              {b.distanceKm < 1
                                ? `${Math.round(b.distanceKm * 1000)} m`
                                : `${b.distanceKm.toFixed(1)} km`}
                            </span>
                          )}
                        </div>
                        {b.approximateLocation && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{b.approximateLocation}</p>
                        )}
                        {/* Keyed by SELLER, not by `b.id` — see NearbyBusiness. */}
                        <BusinessTrustPanel sellerId={b.sellerId || b.id} className="mt-4" />
                      </div>
                    ))}
                  </div>
                )}

                {shownListings.length > 0 && (
                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                      Listings near you
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {shownListings.map((l) => (
                        <Link
                          key={l.id}
                          href={`/products/${l.id}`}
                          className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/50 transition hover:border-primary"
                        >
                          {l.imageUrl ? (
                            <img src={l.imageUrl} alt={l.title || 'Listing'} className="h-32 w-full object-cover" />
                          ) : (
                            <div className="flex h-32 w-full items-center justify-center bg-neutral-800 text-xs text-neutral-500">
                              No photo
                            </div>
                          )}
                          <div className="p-3">
                            <p className="line-clamp-2 text-xs font-medium text-white">{l.title}</p>
                            {typeof l.price === 'number' && (
                              <p className="mt-1 text-sm font-black text-primary">
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
        </div>
      </div>
    </BuyerLayout>
  );
}
