'use client';

import * as React from 'react';
import { Loader2, MapPin, ShieldCheck, Store } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { SellerCard, SellerSectionTitle } from '@/components/app/seller/seller-app-shell';
import { SellerBusinessLocationForm } from '@/components/app/seller/business-location-form';
import { SellerTierPanel } from '@/components/trust/seller-tier-panel';

/**
 * SELLER APP · BUSINESS (`/app/seller/business`).
 *
 * ## Why this screen exists now
 *
 * The measurement came back with zero of six businesses carrying a location.
 * Until a business says where it works, Nearby cannot rank by distance,
 * request matching cannot find it, and sponsored regional campaigns have
 * nothing to target — so every downstream feature is blocked on one field a
 * seller can fill in about in twenty seconds.
 *
 * The screen reads the business through `/api/businesses/mine` rather than a
 * client query, because membership lives in an array of objects and Firestore
 * cannot query inside one.
 */
export default function SellerBusinessPage() {
  const auth = useAuth();
  const { toast } = useToast();

  const [business, setBusiness] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = auth?.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }
      try {
        const token = await current.getIdToken();
        const res = await fetch('/api/businesses/mine', {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setBusiness(json?.businesses?.[0] ?? null);
      } catch {
        /* surfaced by the empty state below */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, reloadKey]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="vn-page-enter space-y-4 pb-4">
      <SellerSectionTitle eyebrow="Your business" title={business?.name || 'Business'} />

      {!business ? (
        <div className="px-4">
          <SellerCard>
            <Store className="h-6 w-6 text-primary" />
            <p className="font-grotesk mt-3 text-base font-semibold text-foreground">
              No business yet
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Publish your first listing and one is created for you automatically, using your
              shop name. Come back here afterwards to say where you work.
            </p>
          </SellerCard>
        </div>
      ) : (
        <>
          <div className="px-4">
            <SellerCard>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-grotesk text-sm font-semibold text-foreground">
                    {business.primaryLocation?.label || 'Where you work'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {business.primaryLocation
                      ? [
                          business.primaryLocation.areaName,
                          business.primaryLocation.cityName,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'Location set'
                      : 'Not set yet — customers cannot find you nearby until this is filled in.'}
                  </p>
                </div>
              </div>
              {business.verificationStatus !== 'verified' && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    A location is not verification. Getting found is not the same as being
                    checked.
                  </span>
                </p>
              )}
            </SellerCard>
          </div>

          <div className="px-1">
            <SellerBusinessLocationForm
              businessId={business.id}
              initial={business.primaryLocation}
              kind={business.kind}
              role={business.role}
              onSaved={() => {
                setReloadKey((k) => k + 1);
                toast({
                  title: 'Location saved',
                  description: 'Customers nearby can now find this business.',
                });
              }}
            />
          </div>
        </>
      )}

      {/* The tier ladder, in the place where the first sale starts. Mounted
          outside the business branch on purpose: the tier counts buying as well
          as selling, so a seller who has not set a business up yet still has a
          standing, and hiding the meter behind a business would imply the two
          are separate things. */}
      <SellerTierPanel className="px-4 pt-1" />
    </div>
  );
}
