import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbGetShop, pbMirrorShop } from '@/lib/pocketbase/shops';
import { pbUpsertProfile } from '@/lib/pocketbase/profiles';
import { scrubForPocketBase } from '@/lib/pocketbase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET / PUT /api/mobile/seller/shop — the seller's OWN storefront.
 *
 * The Android seller centre has to read and save a shop without sending the
 * seller to the website. Ownership is never taken from the request body: the
 * document id is always the verified uid, so a caller cannot read or write
 * somebody else's shop by changing a field.
 *
 * Storage contract is the same one the website uses (`sellerShops/{uid}` plus
 * the matching profile fields), and every save is mirrored to the VPS
 * PocketBase store so the shop survives a Firestore outage.
 */

const SHOP_ID = (uid: string) => uid;

/** Media references and links we are willing to store. */
function safeUrl(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/media/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function bool(value: unknown): boolean {
  return value === true;
}

interface ShopBody {
  shopName?: unknown;
  category?: unknown;
  description?: unknown;
  phoneNumber?: unknown;
  businessEmail?: unknown;
  location?: unknown;
  cityTown?: unknown;
  county?: unknown;
  website?: unknown;
  socialLinks?: unknown;
  logoUrl?: unknown;
  bannerUrl?: unknown;
  businessType?: unknown;
  offering?: unknown;
  offersDelivery?: unknown;
  offersPickup?: unknown;
  operatingHours?: unknown;
  serviceAreas?: unknown;
  published?: unknown;
  /** Seller's own display name and bio — stored on the profile, not the shop. */
  fullName?: unknown;
  bio?: unknown;
}

function readBody(raw: ShopBody) {
  const businessType = ['physical', 'online', 'both'].includes(String(raw.businessType))
    ? String(raw.businessType)
    : '';
  const offering = ['products', 'services', 'both'].includes(String(raw.offering))
    ? String(raw.offering)
    : '';

  const socialLinks = Array.isArray(raw.socialLinks)
    ? raw.socialLinks
        .map((item) => {
          const entry = (item ?? {}) as { label?: unknown; url?: unknown };
          const url = safeUrl(entry.url);
          if (!url) return null;
          return { label: text(entry.label, 40) || 'Link', url };
        })
        .filter((v): v is { label: string; url: string } => Boolean(v))
        .slice(0, 6)
    : [];

  return {
    shopName: text(raw.shopName, 80),
    category: text(raw.category, 60),
    description: text(raw.description, 2000),
    phoneNumber: text(raw.phoneNumber, 40),
    businessEmail: text(raw.businessEmail, 120),
    location: text(raw.location, 120),
    cityTown: text(raw.cityTown, 80),
    county: text(raw.county, 80),
    website: safeUrl(raw.website) ?? '',
    socialLinks,
    logoUrl: safeUrl(raw.logoUrl) ?? '',
    bannerUrl: safeUrl(raw.bannerUrl) ?? '',
    businessType,
    offering,
    offersDelivery: bool(raw.offersDelivery),
    offersPickup: bool(raw.offersPickup),
    operatingHours: text(raw.operatingHours, 200),
    serviceAreas: text(raw.serviceAreas, 200),
    published: bool(raw.published),
  };
}

/** Profile-only fields a seller may edit from the app. */
function readProfileFields(raw: ShopBody) {
  return {
    fullName: text(raw.fullName, 80),
    bio: text(raw.bio, 500),
  };
}

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const snap = await db.collection('sellerShops').doc(SHOP_ID(user.uid)).get().catch(() => null);
    if (snap?.exists) {
      return NextResponse.json({ shop: { id: snap.id, ...(snap.data() ?? {}) }, source: 'firestore' });
    }
  } catch (error) {
    console.error('[mobile/seller/shop] Firestore read failed:', error);
  }

  // Firestore has no shop (or is unreachable) — answer from the VPS copy.
  const mirrored = await pbGetShop(user.uid);
  if (mirrored) {
    return NextResponse.json({
      shop: { id: mirrored.id, ...(mirrored.data ?? {}) },
      source: 'vps',
    });
  }

  return NextResponse.json({ shop: null, source: 'none' });
}

export async function PUT(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as ShopBody;
  const fields = readBody(body);
  const profileFields = readProfileFields(body);

  if (fields.shopName.length < 2) {
    return NextResponse.json({ error: 'Give your shop a name of at least 2 characters.' }, { status: 400 });
  }
  if (!fields.category) {
    return NextResponse.json({ error: 'Choose the category that fits your business.' }, { status: 400 });
  }
  if (fields.description.length < 10) {
    return NextResponse.json({ error: 'Add a short description (at least 10 characters).' }, { status: 400 });
  }
  if (!fields.location) {
    return NextResponse.json({ error: 'Add your location so buyers can find you.' }, { status: 400 });
  }
  if (fields.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.businessEmail)) {
    return NextResponse.json({ error: 'That business email looks incomplete.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const shopData = {
    sellerId: user.uid,
    ...fields,
    updatedAt: now,
    ...(fields.published ? { publishedAt: now } : {}),
  };

  let firestoreSaved = false;
  try {
    await db.collection('sellerShops').doc(SHOP_ID(user.uid)).set(shopData, { merge: true });
    firestoreSaved = true;
  } catch (error) {
    console.error('[mobile/seller/shop] Firestore write failed:', error);
  }

  // The account must become seller-capable, and the profile's shop name/logo
  // have to agree with the storefront — one write, never a half-updated shop.
  let profileSaved = false;
  try {
    const profilePatch: Record<string, unknown> = {
      shopName: fields.shopName,
      userRole: 'seller',
      role: 'seller',
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (fields.phoneNumber) profilePatch.phoneNumber = fields.phoneNumber;
    if (fields.logoUrl) profilePatch.profilePictureUrl = fields.logoUrl;
    if (profileFields.fullName) profilePatch.fullName = profileFields.fullName;
    if (profileFields.bio) profilePatch.bio = profileFields.bio;
    await db.collection('userProfiles').doc(user.uid).set(profilePatch, { merge: true });
    profileSaved = true;
  } catch (error) {
    console.error('[mobile/seller/shop] profile write failed:', error);
  }

  const mirrored = await pbMirrorShop(
    user.uid,
    scrubForPocketBase(shopData) as Record<string, unknown>,
  );
  if (profileSaved || firestoreSaved) {
    await pbUpsertProfile(user.uid, {
      shopName: fields.shopName,
      userRole: 'seller',
      ...(fields.phoneNumber ? { phoneNumber: fields.phoneNumber } : {}),
      ...(fields.logoUrl ? { profilePictureUrl: fields.logoUrl } : {}),
      ...(profileFields.fullName ? { fullName: profileFields.fullName } : {}),
    });
  }

  if (!firestoreSaved && !mirrored) {
    return NextResponse.json(
      { error: 'Could not save your shop. Check your connection and try again.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    shop: { id: SHOP_ID(user.uid), ...shopData },
    mirrored,
  });
}
