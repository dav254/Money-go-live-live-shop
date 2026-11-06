/**
 * GET /api/discover/places — the manual location picker's data.
 *
 * The county list is the platform's existing `kenyaLocations` vocabulary, so
 * the picker offers the same places the seller forms do. Counts come from a
 * bounded scan of `sellerShops` and are advisory ("12 sellers") — every county
 * stays selectable even when it currently has none, because an empty county is
 * a real answer and a hidden one would look like a bug.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { kenyaLocations } from '@/lib/location-data';
import { clientKey, rateLimit } from '@/lib/discover/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHOP_WINDOW = 400;

export async function GET(request: Request) {
  const limit = rateLimit(`places:${clientKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const counts = new Map<string, number>();

  try {
    const snap = await db.collection('sellerShops').limit(SHOP_WINDOW).get();
    for (const doc of snap.docs) {
      const county = doc.get('county');
      if (typeof county === 'string' && county.trim()) {
        const key = county.trim();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  } catch {
    // A listing of places with no counts is still a working picker.
    console.error('[discover] place counts unavailable');
  }

  const places = Object.keys(kenyaLocations)
    .map((name) => ({ name, count: counts.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({ places, windowCapped: false });
}
