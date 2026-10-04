'use client';

import * as React from 'react';
import { Crosshair, Loader2, MapPin, Pencil, X } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { SEED_LOCATIONS, childrenOf } from '@/lib/locations/hierarchy';
import {
  customerLocationLabel,
  hasUsableCustomerLocation,
  type CustomerLocation,
} from '@/lib/locations/customer';
import { cn } from '@/lib/utils';

/**
 * WHERE ARE YOU?
 *
 * ## Both paths, on purpose
 *
 * The spec says GPS if granted, manual if not — and that is not a fallback
 * arrangement, it is two equal doors. Plenty of people will not grant location
 * to a marketplace, and plenty of people know their area better than a phone
 * does. Neither is the degraded version.
 *
 * ## The third door is the important one
 *
 * "Type your area" takes a name we may have no row for, because the customers
 * who matter are not all inside the seed table. That path saves the text plus
 * whatever coordinates the browser already knows, and it works in Lagos exactly
 * as it does in Westlands. Everything downstream ranks on distance, so an
 * unmapped customer is not a broken customer — they are a customer we describe
 * by their own words.
 */

const COUNTRIES = SEED_LOCATIONS.filter((l) => l.level === 'country');

const pickClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary';

export function CustomerLocationPicker({
  location,
  onLocationChange,
  compact = false,
}: {
  location?: CustomerLocation | null;
  onLocationChange?: (next: CustomerLocation | null) => void;
  compact?: boolean;
}) {
  const auth = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [countryId, setCountryId] = React.useState('');
  const [countyId, setCountyId] = React.useState('');
  const [cityId, setCityId] = React.useState('');
  const [areaId, setAreaId] = React.useState('');
  const [typedArea, setTypedArea] = React.useState('');

  const known = hasUsableCustomerLocation(location);

  async function send(payload: Record<string, unknown>) {
    const current = auth?.currentUser;
    if (!current) {
      toast({ title: 'Sign in again', description: 'Your session expired.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const token = await current.getIdToken();
      const res = await fetch('/api/me/location', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Could not save', description: json?.error || 'Try again.', variant: 'destructive' });
        return;
      }
      onLocationChange?.((json?.location ?? null) as CustomerLocation | null);
      setEditing(false);
    } catch {
      toast({ title: 'No connection', description: 'Your location was not saved.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ask the browser once, and say plainly what happens either way.
   *
   * The refusal path is not an error state — a customer who taps "No" is then
   * one tap from typing their area, and that is where the promise lives.
   */
  function useMyLocation() {
    if (!navigator.geolocation) {
      setEditing(true);
      toast({ title: 'No location on this device', description: 'Choose your area below instead.' });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        send({ mode: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy(false);
        setEditing(true);
        toast({
          title: 'No problem — choose your area',
          description: 'We only use your location to show what is near you.',
        });
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function clear() {
    const current = auth?.currentUser;
    if (!current) return;
    setBusy(true);
    try {
      const token = await current.getIdToken();
      await fetch('/api/me/location', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'clear' }),
      });
      onLocationChange?.(null);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className={cn('flex items-center justify-between gap-2', compact ? 'px-4' : '')}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-left transition hover:border-primary"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {known ? 'Your area' : 'Location not set'}
            </span>
            <span className="block truncate text-xs font-semibold text-foreground">
              {customerLocationLabel(location)}
            </span>
          </span>
        </button>
        {known && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={busy}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Update'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', compact ? 'px-4' : '')}>
      <div className="flex items-center justify-between">
        <p className="font-grotesk text-sm font-semibold text-foreground">Where are you?</p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Close"
          className="rounded-full p-1 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        Use my current location
      </button>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Only used to show you what is near you. Never shown to a seller.
      </p>

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Choose your area
      </p>

      <label className="block">
        <select
          className={pickClass}
          value={countryId}
          onChange={(e) => {
            setCountryId(e.target.value);
            setCountyId('');
            setCityId('');
            setAreaId('');
          }}
        >
          <option value="">Country…</option>
          {COUNTRIES.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <select
          className={pickClass}
          value={countyId}
          disabled={!countryId}
          onChange={(e) => {
            setCountyId(e.target.value);
            setCityId('');
            setAreaId('');
          }}
        >
          <option value="">{countryId ? 'County…' : 'Pick a country'}</option>
          {childrenOf(countryId)
            .filter((l) => l.level === 'county')
            .map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
        </select>
      </label>

      <label className="block">
        <select
          className={pickClass}
          value={cityId}
          disabled={!countyId}
          onChange={(e) => {
            setCityId(e.target.value);
            setAreaId('');
          }}
        >
          <option value="">{countyId ? 'City…' : 'Pick a county'}</option>
          {childrenOf(countyId)
            .filter((l) => l.level === 'city')
            .map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
        </select>
      </label>

      <label className="block">
        <select
          className={pickClass}
          value={areaId}
          disabled={!cityId}
          onChange={(e) => setAreaId(e.target.value)}
        >
          <option value="">{cityId ? 'Area…' : 'Pick a city'}</option>
          {childrenOf(cityId).map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => send({ mode: 'tree', areaOrCityId: areaId || cityId || countyId || countryId })}
        disabled={busy || !(areaId || cityId || countyId || countryId)}
        className="w-full rounded-xl border border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-foreground transition disabled:opacity-60"
      >
        Save this area
      </button>

      <div className="rounded-xl border border-border p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Anywhere else in the world
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          We do not limit Vidnov to one country. Type your town or area and it
          works the same way.
        </p>
        <div className="mt-2.5 flex gap-2">
          <input
            className={pickClass}
            value={typedArea}
            placeholder="e.g. Kampala"
            onChange={(e) => setTypedArea(e.target.value)}
          />
          <button
            type="button"
            onClick={() => send({ mode: 'label', label: typedArea })}
            disabled={busy || !typedArea.trim()}
            className="shrink-0 rounded-xl border border-border px-3 text-[10px] font-bold uppercase tracking-wider text-foreground transition disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {known && (
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="w-full text-[11px] text-muted-foreground underline disabled:opacity-60"
        >
          Turn off my location
        </button>
      )}
    </div>
  );
}
