'use client';

import * as React from 'react';
import {
  BadgeCheck, Clock, Loader2, LogOut, Mail, MapPin, Plus, RotateCcw, Save,
  ShieldCheck, Store, Target, Truck, UploadCloud, User as UserIcon, X,
} from 'lucide-react';

import { collection, doc, increment, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import {
  useAuth, useCollection, useDoc, useFirestore, useMemoFirebase, useStorage,
  useUser, useUserProfile,
} from '@/firebase';
import type { Order, SellerShop, UserProfile } from '@/lib/types';
import { REQUEST_CATEGORIES } from '@/lib/requests/types';
import { SecurityAndSessions } from '@/components/account/security-and-sessions';
import { useSignOutToHome } from '@/lib/auth/sign-out-to-home';
import { useToast } from '@/hooks/use-toast';
import { SellerCard, SellerSectionTitle } from '@/components/app/seller/seller-app-shell';
import { cn } from '@/lib/utils';

/**
 * SELLER APP · SETTINGS (`/app/seller/account`).
 *
 * ## What this screen is
 *
 * The old version of this screen was a read-only summary: an identity band,
 * three numbers, a shop card that could not be edited from it, and two exits.
 * It described the account without letting the seller change anything — which
 * is why "my settings are on the website" kept coming up. Everything a seller
 * needs to change now lives here, in this section, in this shell.
 *
 * ## The sections, and why these
 *
 * They are grouped by *what the seller is trying to do*, not by which table
 * the field lives in, and each one saves on its own. Per-section saves matter
 * here: a seller changing their WhatsApp number must not be able to overwrite
 * the delivery policy they wrote last month with a stale value from a form
 * that loaded before the network answered.
 *
 *   You        name, phone, bio            — who buyers are dealing with
 *   Your shop  name, description, category, logo, banner
 *                                         — what this business is, and how
 *                                           it looks in the storefront
 *   Where you work  country → area, WhatsApp, target markets
 *                                         — drives request matching AND
 *                                           shipping cost expectations
 *   Buyer trust hours, delivery, returns  — the three fields My Shop shows as
 *                                           "Not set yet" when they are blank
 *   Security   sessions + password        — reused, not rebuilt
 *
 * **Category and location are not vanity fields.** The request matching engine
 * scores briefs against them, so an empty category is the single most expensive
 * setting a seller can leave blank — hence target markets and location sit in
 * their own section rather than being buried at the bottom.
 *
 * ## No "Use the website"
 *
 * That exit used to sit at the bottom of this screen. It is gone: a settings
 * screen whose last act is to leave the app is not a settings screen. Signing
 * out remains, because it is the only thing here that is genuinely about the
 * device rather than the account.
 */

/** Cost per newly added target market — mirrors the website's rule exactly. */
const POINTS_PER_TARGET = 10;

/* ── Shared field primitives ─────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary';

const areaClass = `${inputClass} resize-none leading-relaxed`;

function SaveButton({
  saving,
  onClick,
  label = 'Save',
}: {
  saving: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {saving ? 'Saving…' : label}
    </button>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4">
      <SellerCard className="vn-app-card space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </SellerCard>
    </section>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

export default function SellerSectionAccount() {
  const auth = useAuth();
  const signOutAndGoHome = useSignOutToHome(auth);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  // Surface-bound storage — bare `getStorage()` asks for the `[DEFAULT]` app,
  // which this project never creates, and throws `app/no-app` on tap.
  const storage = useStorage();
  const { toast } = useToast();

  const shopRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'sellerShops', user.uid);
  }, [firestore, user]);

  // Orders must stay filtered by seller — `firestore.rules` rejects a bare list.
  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: shop } = useDoc<SellerShop>(shopRef);
  const { data: orders } = useCollection<Order>(ordersQuery);

  /* Identity */
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [identitySeeded, setIdentitySeeded] = React.useState(false);
  const [savingIdentity, setSavingIdentity] = React.useState(false);

  /* Shop */
  const [shopName, setShopName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [bannerUrl, setBannerUrl] = React.useState('');
  const [shopSeeded, setShopSeeded] = React.useState(false);
  const [savingShop, setSavingShop] = React.useState(false);
  const [uploading, setUploading] = React.useState<'logo' | 'banner' | null>(null);

  /* Location + reach */
  const [country, setCountry] = React.useState('');
  const [county, setCounty] = React.useState('');
  const [town, setTown] = React.useState('');
  const [area, setArea] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [targets, setTargets] = React.useState<string[]>([]);
  const [newTarget, setNewTarget] = React.useState('');
  const [placeSeeded, setPlaceSeeded] = React.useState(false);
  const [savingPlace, setSavingPlace] = React.useState(false);

  /* Trust */
  const [hours, setHours] = React.useState('');
  const [delivery, setDelivery] = React.useState('');
  const [returns, setReturns] = React.useState('');
  const [trustSeeded, setTrustSeeded] = React.useState(false);
  const [savingTrust, setSavingTrust] = React.useState(false);

  /**
   * Seed each form exactly once, from the signed-in profile.
   *
   * The `*Seeded` flags are load-bearing, not defensive noise: `useUserProfile`
   * and `useDoc` resolve independently, so an unguarded effect re-seeds on every
   * snapshot and silently wipes whatever the seller has typed in the meantime.
   */
  React.useEffect(() => {
    if (!userProfile || identitySeeded) return;
    setFullName(userProfile.fullName ?? '');
    setPhone(userProfile.phoneNumber ?? '');
    setBio(userProfile.bio ?? '');
    setIdentitySeeded(true);
  }, [userProfile, identitySeeded]);

  React.useEffect(() => {
    if (!shop || shopSeeded) return;
    setShopName(shop.shopName ?? '');
    setDescription(shop.description ?? '');
    setCategory(shop.category ?? '');
    setLogoUrl(shop.logoUrl ?? '');
    setBannerUrl(shop.bannerUrl ?? '');
    setCountry(shop.country ?? '');
    setCounty(shop.county ?? '');
    setTown(shop.cityTown ?? '');
    setArea(shop.area ?? '');
    setWhatsapp(shop.contactWhatsapp ?? '');
    setTargets(shop.targetLocations ?? []);
    setHours(shop.storeHours ?? '');
    setDelivery(shop.deliveryPolicy ?? '');
    setReturns(shop.returnPolicy ?? '');
    setShopSeeded(true);
    setPlaceSeeded(true);
    setTrustSeeded(true);
  }, [shop, shopSeeded, placeSeeded, trustSeeded]);

  const initials = (userProfile?.fullName || 'Seller')
    .split(' ')
    .map((p: string) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  /* ── Save: you ─────────────────────────────────────────────────────────── */

  const saveIdentity = async () => {
    if (!user || !firestore) return;
    setSavingIdentity(true);
    try {
      await setDoc(
        doc(firestore, 'userProfiles', user.uid),
        { fullName: fullName.trim(), phoneNumber: phone.trim(), bio: bio.trim() },
        { merge: true },
      );
      toast({ title: 'Details saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your details' });
    } finally {
      setSavingIdentity(false);
    }
  };

  /* ── Save: your shop ───────────────────────────────────────────────────── */

  const saveShop = async () => {
    if (!user || !firestore) return;
    if (!shopName.trim()) {
      toast({ variant: 'destructive', title: 'Your shop needs a name' });
      return;
    }
    setSavingShop(true);
    try {
      // One batch across both documents: the storefront and the profile must
      // never disagree about the shop's name or logo.
      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, 'sellerShops', user.uid),
        {
          sellerId: user.uid,
          shopName: shopName.trim(),
          description: description.trim(),
          category,
          logoUrl,
          bannerUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      batch.set(
        doc(firestore, 'userProfiles', user.uid),
        { shopName: shopName.trim(), profilePictureUrl: logoUrl },
        { merge: true },
      );
      await batch.commit();
      toast({ title: 'Shop saved', description: 'Your storefront is updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your shop' });
    } finally {
      setSavingShop(false);
    }
  };

  /* ── Save: where you work ──────────────────────────────────────────────── */

  const savePlace = async () => {
    if (!user || !firestore || !userProfile) return;

    // New target markets cost points, exactly as they do on the website. The
    // check happens before any write so a seller is never left half-charged.
    const existing = shop?.targetLocations ?? [];
    const added = targets.filter((t) => !existing.includes(t));
    const cost = added.length * POINTS_PER_TARGET;
    if (cost > (userProfile.aiPoints ?? 0)) {
      toast({
        variant: 'destructive',
        title: 'Not enough points',
        description: `Adding ${added.length} new market${added.length === 1 ? '' : 's'} costs ${cost} points. You have ${userProfile.aiPoints ?? 0}.`,
      });
      return;
    }

    setSavingPlace(true);
    try {
      // Buyers read a single location string; the parts stay in their own
      // fields for matching. Both are written, so neither can go stale.
      const parts = [area, town, county, country].filter(Boolean);
      const locationString = parts.join(', ') || 'Global';
      const batch = writeBatch(firestore);

      batch.set(
        doc(firestore, 'sellerShops', user.uid),
        {
          country: country.trim(),
          county: county.trim(),
          cityTown: town.trim(),
          area: area.trim(),
          location: locationString,
          contactWhatsapp: whatsapp.trim(),
          targetLocations: targets,
        },
        { merge: true },
      );
      batch.set(doc(firestore, 'userProfiles', user.uid), { location: locationString }, { merge: true });
      if (cost > 0) {
        batch.set(
          doc(firestore, 'userProfiles', user.uid),
          { aiPoints: increment(-cost) },
          { merge: true },
        );
      }
      await batch.commit();
      toast({
        title: 'Location saved',
        description: cost > 0 ? `${cost} points deducted for new markets.` : undefined,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your location' });
    } finally {
      setSavingPlace(false);
    }
  };

  /* ── Save: buyer trust ─────────────────────────────────────────────────── */

  const saveTrust = async () => {
    if (!user || !firestore) return;
    setSavingTrust(true);
    try {
      await setDoc(
        doc(firestore, 'sellerShops', user.uid),
        {
          storeHours: hours.trim(),
          deliveryPolicy: delivery.trim(),
          returnPolicy: returns.trim(),
        },
        { merge: true },
      );
      toast({ title: 'Policies saved', description: 'Buyers see these on your shop page.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your policies' });
    } finally {
      setSavingTrust(false);
    }
  };

  /* ── Image upload (same Storage convention as the website) ─────────────── */

  const uploadImage = async (file: File, kind: 'logo' | 'banner') => {
    if (!user) return null;
    try {
      const storageRef = ref(storage, `shops/${user.uid}/${kind}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);
      setUploading(kind);
      await task;
      const url = await getDownloadURL(task.snapshot.ref);
      return url;
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Try a smaller image.' });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const addTarget = () => {
    const value = newTarget.trim().toUpperCase();
    if (!value) return;
    if (targets.includes(value)) {
      setNewTarget('');
      return;
    }
    const added = targets.filter((t) => !shop?.targetLocations?.includes(t)).length + 1;
    setTargets([...targets, value]);
    setNewTarget('');
    toast({
      title: 'Market added',
      description: `Saves with your next change · ${added * POINTS_PER_TARGET} points.`,
    });
  };

  const missing = [
    !shop?.shopName && 'shop name',
    !shop?.category && 'category',
    !shop?.deliveryPolicy && 'delivery policy',
    !shop?.returnPolicy && 'return policy',
    !shop?.storeHours && 'opening hours',
  ].filter(Boolean) as string[];

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle eyebrow="Section" title="Settings" />

      {/* Identity band — same ember treatment as the section overview. */}
      <section className="px-4">
        <div className="vn-seller-band vn-app-card flex items-center gap-4 rounded-2xl p-4 shadow-lg">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/25">
            {logoUrl || userProfile?.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl || userProfile?.profilePictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">
              {userProfile?.fullName || 'Seller'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/70">
              <Mail className="h-3 w-3 shrink-0" />
              {user?.email}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-white/25">
            Seller
          </span>
        </div>
      </section>

      {/* Numbers */}
      <section className="grid grid-cols-3 gap-2.5 px-4">
        {[
          { label: 'Orders', value: isProfileLoading ? '—' : String(orders?.length ?? 0) },
          { label: 'Followers', value: shop?.followers != null ? String(shop.followers) : '—' },
          { label: 'AI points', value: (userProfile?.aiPoints ?? 0).toLocaleString() },
        ].map((stat) => (
          <div
            key={stat.label}
            className="vn-app-card rounded-2xl border border-border/80 bg-card px-3 py-3 text-center"
          >
            <p className="font-grotesk text-lg font-bold tabular-nums text-foreground">{stat.value}</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* The one thing standing between this seller and matched work. */}
      {missing.length > 0 && (
        <section className="px-4">
          <SellerCard className="vn-app-card border-amber-500/40 bg-amber-500/8 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
              Finish your setup
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Still missing: <span className="font-semibold text-foreground">{missing.join(', ')}</span>.
              Until these are filled in, buyers see gaps on your shop and the request matcher has
              little to match you against.
            </p>
          </SellerCard>
        </section>
      )}

      {/* ── You ───────────────────────────────────────────────────────────── */}
      <SectionCard
        icon={UserIcon}
        title="You"
        description="How buyers and the platform refer to you."
      >
        <Field label="Full name">
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name as buyers should see it"
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 7…"
          />
        </Field>
        <Field label="Short bio" hint="One or two lines. Appears on your profile.">
          <textarea
            className={areaClass}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you do, how long you have done it, what you are known for"
          />
        </Field>
        <SaveButton saving={savingIdentity} onClick={saveIdentity} />
      </SectionCard>

      {/* ── Your shop ─────────────────────────────────────────────────────── */}
      <SectionCard
        icon={Store}
        title="Your shop"
        description="Your storefront. This is what buyers see before they buy."
      >
        <Field label="Shop name">
          <input
            className={inputClass}
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="e.g. Nord Home"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Logo
            </span>
            <LogoPicker
              src={logoUrl}
              busy={uploading === 'logo'}
              onPick={(file) =>
                uploadImage(file, 'logo').then((url) => {
                  if (url) setLogoUrl(url);
                })
              }
              onClear={() => setLogoUrl('')}
            />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Banner
            </span>
            <BannerPicker
              src={bannerUrl}
              busy={uploading === 'banner'}
              onPick={(file) =>
                uploadImage(file, 'banner').then((url) => {
                  if (url) setBannerUrl(url);
                })
              }
              onClear={() => setBannerUrl('')}
            />
          </div>
        </div>

        <Field label="Category" hint="Decides which customer briefs reach you. The single most valuable setting on this screen.">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose…</option>
            {REQUEST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" hint="What you make or sell, and what makes you different.">
          <textarea
            className={areaClass}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Custom furniture and interior pieces, built to order in Westlands."
          />
        </Field>

        <SaveButton saving={savingShop} onClick={saveShop} label="Save shop" />
      </SectionCard>

      {/* ── Where you work ────────────────────────────────────────────────── */}
      <SectionCard
        icon={MapPin}
        title="Where you work"
        description="Used for delivery expectations and for matching you to nearby briefs."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Kenya" />
          </Field>
          <Field label="County">
            <input className={inputClass} value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Nairobi" />
          </Field>
          <Field label="Town / City">
            <input className={inputClass} value={town} onChange={(e) => setTown(e.target.value)} placeholder="Westlands" />
          </Field>
          <Field label="Area">
            <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="CBD" />
          </Field>
        </div>

        <Field label="WhatsApp" hint="Buyers use this to reach you about an offer.">
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+254 7…"
          />
        </Field>

        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Target className="h-3 w-3" /> Target markets
          </span>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Where your listings are shown first. New markets cost {POINTS_PER_TARGET} points each.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              className={cn(inputClass, 'mt-0')}
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTarget();
                }
              }}
              placeholder="Add a city or country"
            />
            <button
              type="button"
              onClick={addTarget}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3.5 text-xs font-semibold uppercase tracking-wider text-foreground transition hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {targets.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {targets.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTargets(targets.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="transition hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] italic text-muted-foreground">
              None set — your listings show everywhere.
            </p>
          )}
        </div>

        <SaveButton saving={savingPlace} onClick={savePlace} label="Save location" />
      </SectionCard>

      {/* ── Buyer trust ───────────────────────────────────────────────────── */}
      <SectionCard
        icon={ShieldCheck}
        title="Buyer trust"
        description="Answer the three questions buyers ask before they pay anyone new."
      >
        <Field label="Opening hours">
          <input
            className={inputClass}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="9 AM – 6 PM, Mon – Sat"
          />
        </Field>
        <Field label="Delivery" hint="How long, and how. Blank shows up as “Not set yet” on your shop.">
          <textarea
            className={areaClass}
            rows={3}
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            placeholder="Delivered within 3 days in Nairobi. Nationwide in 5–7 days."
          />
        </Field>
        <Field label="Returns" hint="Blank shows up as “Not set yet” on your shop.">
          <textarea
            className={areaClass}
            rows={3}
            value={returns}
            onChange={(e) => setReturns(e.target.value)}
            placeholder="Returnable within 7 days, unused and in original packaging."
          />
        </Field>
        <SaveButton saving={savingTrust} onClick={saveTrust} label="Save policies" />
      </SectionCard>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <section className="px-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BadgeCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Devices signed in to your account, and your password.
            </p>
          </div>
        </div>
        {/* Not wrapped in a SellerCard: this component brings its own card
            chrome, and nesting one rounded container inside another reads as a
            rendering bug rather than a section. */}
        <SecurityAndSessions />
      </section>

      {/* ── The only exit ──────────────────────────────────────────────────── */}
      <section className="px-4">
        <button
          type="button"
          onClick={signOutAndGoHome}
          className="vn-app-card flex w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 text-left transition hover:bg-destructive/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-destructive">Sign out of the app</span>
            <span className="block text-[11px] text-muted-foreground">Only this device&apos;s app session</span>
          </span>
        </button>
      </section>

      <p className="px-4 pb-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Vidnov seller app · settings
      </p>
    </div>
  );
}

/* ── Image pickers ───────────────────────────────────────────────────────── */

function LogoPicker({
  src,
  busy,
  onPick,
  onClear,
}: {
  src: string;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="mt-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      {src ? (
        <div className="group relative h-24 w-24 overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove logo"
            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}

function BannerPicker({
  src,
  busy,
  onPick,
  onClear,
}: {
  src: string;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="mt-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      {src ? (
        <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove banner"
            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}