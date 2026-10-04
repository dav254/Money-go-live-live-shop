'use client';

import * as React from 'react';
import { Loader2, MapPin, Save } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { SellerCard } from '@/components/app/seller/seller-app-shell';
import {
  SEED_LOCATIONS,
  childrenOf,
  locationAncestry,
} from '@/lib/locations/hierarchy';
import { RADIUS_PRESETS_KM } from '@/lib/locations/hierarchy';
import type { BusinessKind, BusinessLocation } from '@/lib/business/types';
import { MAX_SERVICE_RADIUS_KM } from '@/lib/business/location';

/**
 * WHERE THIS BUSINESS WORKS.
 *
 * ## The control that matters on this screen
 *
 * "Show my exact point" is offered, and for a home-based or service business it
 * is **disabled and cannot be enabled**. The server drops the coordinates for
 * those kinds regardless of what arrives, so this is a courtesy in the UI
 * rather than the enforcement — but it matters that the seller is told plainly
 * *before* they go looking for a setting that does not exist, instead of
 * discovering the choice was never available.
 *
 * A plumber needs a customer to know roughly where they work. A plumber does
 * not need a customer to know which house is theirs.
 */

const COUNTRIES = SEED_LOCATIONS.filter((l) => l.level === 'country');

function areasOf(cityId: string | undefined) {
  return cityId ? childrenOf(cityId).filter((l) => l.level === 'area') : [];
}

function citiesOf(countyId: string | undefined) {
  return countyId ? childrenOf(countyId).filter((l) => l.level === 'city') : [];
}

function countiesOf(countryId: string | undefined) {
  return countryId ? childrenOf(countryId).filter((l) => l.level === 'county') : [];
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary';

const AREA_ONLY_KINDS: BusinessKind[] = ['home_based', 'service_provider', 'mobile'];

export function SellerBusinessLocationForm({
  businessId,
  initial,
  kind,
  role,
  onSaved,
}: {
  businessId: string;
  initial?: BusinessLocation | null;
  kind?: BusinessKind;
  role?: string | null;
  onSaved?: () => void;
}) {
  const auth = useAuth();
  const { toast } = useToast();
  const canEdit = role === 'owner' || role === 'manager';

  const initialChain = React.useMemo(() => {
    const deepest = initial?.areaId ?? initial?.cityId ?? initial?.countyId ?? initial?.countryId;
    const chain = deepest ? locationAncestry(deepest) : [];
    return {
      countryId: chain.find((n) => n.level === 'country')?.id ?? initial?.countryId ?? '',
      countyId: chain.find((n) => n.level === 'county')?.id ?? initial?.countyId ?? '',
      cityId: chain.find((n) => n.level === 'city')?.id ?? initial?.cityId ?? '',
      areaId: chain.find((n) => n.level === 'area')?.id ?? initial?.areaId ?? '',
    };
  }, [initial]);

  const [countryId, setCountryId] = React.useState(initialChain.countryId);
  const [countyId, setCountyId] = React.useState(initialChain.countyId);
  const [cityId, setCityId] = React.useState(initialChain.cityId);
  const [areaId, setAreaId] = React.useState(initialChain.areaId);
  const [radius, setRadius] = React.useState(String(initial?.serviceRadiusKm ?? ''));
  const [label, setLabel] = React.useState(initial?.label ?? '');
  const [lat, setLat] = React.useState<number | null>(
    typeof initial?.lat === 'number' ? initial.lat : null,
  );
  const [lng, setLng] = React.useState<number | null>(
    typeof initial?.lng === 'number' ? initial.lng : null,
  );
  const [locating, setLocating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const areaOnlyByKind = kind ? AREA_ONLY_KINDS.includes(kind) : false;
  const canPublishPoint = !areaOnlyByKind;

  // If the business kind forbids a precise point, any captured coordinates are
  // discarded — re-saving must not resurrect them from a stale `initial`.
  React.useEffect(() => {
    if (!canPublishPoint && (lat !== null || lng !== null)) {
      setLat(null);
      setLng(null);
    }
  }, [canPublishPoint, lat, lng]);

  /**
   * Read the device position. Only offered where a precise point is allowed,
   * and it does nothing until the seller confirms it — the phone's idea of
   * "here" is often home, not the shop, so the number is shown before it is
   * sent anywhere.
   */
  async function useMyPosition() {
    if (!navigator.geolocation) {
      toast({ title: 'No location on this device', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 1e5) / 1e5);
        setLng(Math.round(pos.coords.longitude * 1e5) / 1e5);
        setLocating(false);
        toast({
          title: 'Position captured',
          description: 'Check it, then save. Nothing is stored until you save.',
        });
      },
      () => {
        setLocating(false);
        toast({
          title: 'Location permission denied',
          description: 'Your area is still enough for customers to find you.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    const current = auth?.currentUser;
    if (!current) {
      toast({ title: 'Sign in again', description: 'Your session expired.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const token = await current.getIdToken();
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/location`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label || null,
          countryId: countryId || null,
          countyId: countyId || null,
          cityId: cityId || null,
          areaId: areaId || null,
          // Coordinates travel only when the seller captured them and the
          // business kind allows a published point. We never geocode on their
          // behalf — a made-up pin is worse than no pin.
          lat,
          lng,
          serviceRadiusKm: radius === '' ? null : Number(radius),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Could not save', description: json?.error || 'Try again.', variant: 'destructive' });
        return;
      }
      onSaved?.();
    } catch {
      toast({ title: 'No connection', description: 'Your location was not saved.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SellerCard>
      <p className="font-grotesk flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        Where you work
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Country
          </span>
          <select
            className={inputClass}
            value={countryId}
            disabled={!canEdit}
            onChange={(e) => {
              setCountryId(e.target.value);
              setCountyId('');
              setCityId('');
              setAreaId('');
            }}
          >
            <option value="">Choose…</option>
            {COUNTRIES.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            County
          </span>
          <select
            className={inputClass}
            value={countyId}
            disabled={!canEdit || !countryId}
            onChange={(e) => {
              setCountyId(e.target.value);
              setCityId('');
              setAreaId('');
            }}
          >
            <option value="">{countryId ? 'Choose…' : 'Pick a country first'}</option>
            {countiesOf(countryId).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            City
          </span>
          <select
            className={inputClass}
            value={cityId}
            disabled={!canEdit || !countyId}
            onChange={(e) => {
              setCityId(e.target.value);
              setAreaId('');
            }}
          >
            <option value="">{countyId ? 'Choose…' : 'Pick a county first'}</option>
            {citiesOf(countyId).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Area
          </span>
          <select
            className={inputClass}
            value={areaId}
            disabled={!canEdit || !cityId}
            onChange={(e) => setAreaId(e.target.value)}
          >
            <option value="">{cityId ? 'Choose…' : 'Pick a city first'}</option>
            {areasOf(cityId).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            How far will you travel?
          </span>
          <select
            className={inputClass}
            value={radius}
            disabled={!canEdit}
            onChange={(e) => setRadius(e.target.value)}
          >
            <option value="">Only the areas I serve</option>
            {RADIUS_PRESETS_KM.map((km) => (
              <option key={km} value={String(km)}>Within {km} km</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
            Leave this empty if you only work in specific areas. Maximum {MAX_SERVICE_RADIUS_KM} km.
          </span>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Name this location
          </span>
          <input
            className={inputClass}
            value={label}
            disabled={!canEdit}
            placeholder="e.g. Kilimani workshop"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-foreground">Show my exact point</p>
          {canPublishPoint ? (
            <>
              <button
                type="button"
                onClick={useMyPosition}
                disabled={!canEdit || locating}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-foreground transition disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                Use my current position
              </button>
              {lat !== null && lng !== null ? (
                <>
                  <p className="mt-2 text-[11px] text-foreground">
                    {lat}, {lng}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLat(null);
                      setLng(null);
                    }}
                    className="mt-1 text-[11px] font-semibold text-muted-foreground underline"
                  >
                    Remove the point
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Only do this while standing at the shop. A point captured at home is a
                    customer&rsquo;s address published by accident.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Without a point, customers see &ldquo;{areaId ? 'your area' : 'your city'}&rdquo;
                  &nbsp;— which is usually enough.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Not available for this kind of business. Customers see the area you serve, not a
              point on a map.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !canEdit || (!areaId && !cityId)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save location
      </button>

      {!canEdit && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Only an owner or manager can change where this business works.
        </p>
      )}
    </SellerCard>
  );
}
