'use client';

/**
 * AccountShopProfile — compact shop settings inside the seller Account
 * page (per the new IA: shop settings live with the account, not the
 * sidebar). Writes to sellerShops/{uid}; the full-featured page with
 * logo/banner uploads and targeting remains at /dashboard/seller/settings.
 */

import * as React from 'react';
import { Store, Loader2, MapPin, Phone, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { SellerShop } from '@/lib/types';
import Link from 'next/link';

// Aligned with REQUEST_CATEGORIES so the matching engine scores correctly.
const SHOP_CATEGORIES = [
  'Furniture & Decor',
  'Photography & Video',
  'Events & Catering',
  'Construction & Repair',
  'Fashion & Tailoring',
  'Beauty & Wellness',
  'Transport & Logistics',
  'Technology & Digital',
  'Education & Training',
  'Agriculture',
  'Other',
];

export function AccountShopProfile() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const shopRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'sellerShops', user.uid) : null),
    [user, firestore],
  );
  const { data: shop, isLoading } = useDoc<SellerShop>(shopRef);

  const [shopName, setShopName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [county, setCounty] = React.useState('');
  const [cityTown, setCityTown] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (shop && !loaded) {
      setShopName(shop.shopName ?? '');
      setDescription(shop.description ?? '');
      setCategory(shop.category ?? '');
      setCounty(shop.county ?? '');
      setCityTown(shop.cityTown ?? '');
      setWhatsapp(shop.contactWhatsapp ?? '');
      setLoaded(true);
    }
  }, [shop, loaded]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    setSaving(true);
    try {
      await setDoc(
        doc(firestore, 'sellerShops', user.uid),
        {
          shopName: shopName.trim(),
          description: description.trim(),
          category,
          county: county.trim(),
          cityTown: cityTown.trim(),
          whatsappNumber: undefined,
          contactWhatsapp: whatsapp.trim(),
          sellerId: user.uid,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      toast({ title: 'Shop profile saved', description: 'Matching uses your category & location.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save shop profile' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border">
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading shop…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="font-grotesk text-lg flex items-center gap-2">
          <Store className="h-4.5 w-4.5 text-primary" /> Shop profile
        </CardTitle>
        <CardDescription>
          Your category and location decide which customer requests you see.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="acc-shop-name">Shop name</Label>
            <Input id="acc-shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-11 rounded-xl" placeholder="e.g. Nord Home" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-shop-desc">Description</Label>
            <Textarea
              id="acc-shop-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you make, sell or service — and what makes you different."
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-shop-cat">Category</Label>
              <select
                id="acc-shop-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose…</option>
                {SHOP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-shop-county" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> County
              </Label>
              <Input id="acc-shop-county" value={county} onChange={(e) => setCounty(e.target.value)} className="h-11 rounded-xl" placeholder="e.g. Nairobi" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-shop-city">Town / City</Label>
              <Input id="acc-shop-city" value={cityTown} onChange={(e) => setCityTown(e.target.value)} className="h-11 rounded-xl" placeholder="e.g. Westlands" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-shop-wa" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" /> WhatsApp
              </Label>
              <Input id="acc-shop-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-11 rounded-xl" placeholder="+254 7…  " />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving} className="h-11 rounded-xl font-semibold">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save shop profile
            </Button>
            <Link
              href="/dashboard/seller/settings"
              className="text-[12px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Full shop settings (logo, banner, targeting) →
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
