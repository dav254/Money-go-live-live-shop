import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Listing } from './types';

/**
 * RECENTLY VIEWED — this device, this account.
 *
 * The website keeps the same list in `localStorage` and says so plainly: it is
 * a per-device viewing history, not a server record. The Android app does the
 * same thing with `AsyncStorage`, keyed by uid so two accounts on one phone
 * never see each other's history.
 *
 * Only a snapshot is stored — the fields a row needs to render — because the
 * whole point of this list is to open instantly and to still work when the
 * catalogue request fails. The row links back to `/listing/{id}`, which is
 * where the live price and stock come from.
 *
 * A failure to write is never surfaced: history is a convenience, and a phone
 * with a full disk should not see an error because they opened a listing.
 */

const KEY = 'vidnov.recent.v1';
const LIMIT = 40;

export interface RecentEntry {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  listingType?: 'product' | 'service';
  /** ISO timestamp of the most recent view. */
  at: string;
}

interface Bucket {
  items: RecentEntry[];
}

function storageKey(uid: string): string {
  return `${KEY}.${uid}`;
}

async function readBucket(uid: string): Promise<Bucket> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as Bucket;
    return { items: Array.isArray(parsed?.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

export async function listRecent(uid: string): Promise<RecentEntry[]> {
  const bucket = await readBucket(uid);
  return bucket.items;
}

/** Newest first, one row per listing, capped at 40. */
export async function recordView(uid: string, listing: Listing): Promise<void> {
  if (!uid || !listing?.id) return;
  try {
    const bucket = await readBucket(uid);
    const entry: RecentEntry = {
      id: listing.id,
      name: listing.name || 'Untitled listing',
      price: listing.price ?? listing.localPrice ?? null,
      currency: listing.localCurrency ?? null,
      imageUrl: listing.imageUrl || listing.imageUrls?.[0] || null,
      listingType: listing.listingType,
      at: new Date().toISOString(),
    };
    const items = [entry, ...bucket.items.filter((row) => row.id !== entry.id)].slice(0, LIMIT);
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify({ items }));
  } catch {
    // Never block a screen on history.
  }
}

export async function clearRecent(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(uid));
  } catch {
    // Ignored for the same reason as above.
  }
}
