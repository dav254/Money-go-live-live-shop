'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail,
  MapPin,
  Store,
  UploadCloud,
  Loader2,
  X,
  Phone,
  Globe,
  Info,
  Target,
  Plus,
  BadgeCent,
} from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useUserProfile } from '@/firebase';
import { uploadMedia } from '@/lib/media/upload-client';
import { IMAGE_LIMITS } from '@/lib/media/limits';
import { doc, setDoc, writeBatch, increment } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { SellerShop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { mergeSocialLinks, type SocialLink } from '@/lib/social-links';
import { SOCIAL_LINK_ICONS } from '@/components/seller/social-link-icons';
import {
  SocialLinksEditor,
  linksFromShop,
} from '@/components/app/seller/social-links-editor';

const POINT_COST_PER_TARGET = 10;

const REQUEST_CATEGORIES = [
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

export default function SellerSettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const sellerShopRef = useMemoFirebase(
    () => (user ? doc(firestore, 'sellerShops', user.uid) : null),
    [firestore, user],
  );
  const { data: shopData } = useDoc<SellerShop>(sellerShopRef);
  const { userProfile } = useUserProfile(user?.uid);

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [category, setCategory] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<'logo' | 'banner' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [country, setCountry] = useState('');
  const [county, setCounty] = useState('');
  const [subCounty, setSubCounty] = useState('');
  const [area, setArea] = useState('');

  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [newTarget, setNewTarget] = useState('');

  const [storeHours, setStoreHours] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [deliveryPolicy, setDeliveryPolicy] = useState('');

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialLinksSaved, setSocialLinksSaved] = useState(false);

  useEffect(() => {
    if (!shopData) return;
    setShopName(shopData.shopName ?? '');
    setShopDescription(shopData.description ?? '');
    setCategory(shopData.category ?? '');
    setLogoUrl(shopData.logoUrl ?? null);
    setBannerUrl(shopData.bannerUrl ?? null);
    setContactWhatsapp(shopData.contactWhatsapp ?? '');
    setContactPhone(shopData.contactPhone ?? '');
    setContactEmail(shopData.contactEmail ?? '');
    setCountry(shopData.country ?? '');
    setCounty(shopData.county ?? '');
    setSubCounty(shopData.subCounty ?? '');
    setArea(shopData.area ?? '');
    setTargetLocations(shopData.targetLocations ?? []);
    setStoreHours(shopData.storeHours ?? '');
    setReturnPolicy(shopData.returnPolicy ?? '');
    setDeliveryPolicy(shopData.deliveryPolicy ?? '');

    // Seed the links editor from the current shop document. The editor is its
    // own source of truth — a seller adding a TikTok must not be able to
    // overwrite the delivery policy with a stale value.
    if (!shopData.socialLinks && !shopData.facebookUrl && !shopData.instagramUrl && !shopData.twitterUrl) {
      setSocialLinks([]);
      return;
    }
    setSocialLinks(mergeSocialLinks(shopData));
  }, [shopData]);

  const socialLinksEditor = linksFromShop(shopData ?? {});
  socialLinksEditor.length = 0;
  for (const link of socialLinks) {
    socialLinksEditor.push(link);
  }
  const socialLinksFromShop = socialLinksEditor;

  const addTarget = () => {
    const sanitizedTarget = newTarget.trim().toUpperCase();
    if (sanitizedTarget && !targetLocations.includes(sanitizedTarget)) {
      setTargetLocations([...targetLocations, sanitizedTarget]);
      setNewTarget('');
    }
  };

  const removeTarget = (loc: string) => {
    setTargetLocations(targetLocations.filter((t) => t !== loc));
  };

  const saveSocialLinks = async (links: SocialLink[]) => {
    if (!sellerShopRef || !user) return;
    setIsSaving(true);
    try {
      await setDoc(sellerShopRef, { socialLinks: links }, { merge: true });
      setSocialLinks(links);
      setSocialLinksSaved(true);
      toast({ title: 'Links saved', description: 'They are on your shop now.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your links' });
      throw new Error('save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const ensureSocialLinksSaved = () => {
    // The editor is its own section with its own save, so a seller adding a
    // TikTok must not overwrite the delivery policy with a stale value. If the
    // seller changed links and never pressed Save links, do it now.
    if (socialLinksSaved) return;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveSocialLinks(socialLinks);
  };

  /** Branding images go through the media system, not Firebase Storage. */
  const upload = useCallback(
    async (file: File, kind: 'logo' | 'banner') => {
      if (!user) throw new Error('You must be signed in to upload.');
      setIsUploading(kind);
      setUploadProgress(0);
      try {
        const result = await uploadMedia(file, user, (p) => {
          if (typeof p.percent === 'number') setUploadProgress(p.percent);
        }).promise;
        setIsUploading(null);
        setUploadProgress(0);
        if (result.phase === 'failed' || !result.url) {
          throw new Error(result.error || 'Upload failed.');
        }
        return result.url;
      } catch (error) {
        setIsUploading(null);
        setUploadProgress(0);
        throw error;
      }
    },
    [user],
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'banner') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Client-side size guard, same as the app branding section, so a seller is
    // not made to upload 30 MB of mobile data only to be rejected at the end.
    if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/webp' && file.type !== 'image/gif') {
      toast({
        variant: 'destructive',
        title: 'That is not an image',
        description: 'Choose a PNG, JPEG, WebP or GIF file.',
      });
      return;
    }
    if (file.size > IMAGE_LIMITS.maxUploadMb * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'That image is too large',
        description: `${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${IMAGE_LIMITS.maxUploadMb} MB.`,
      });
      return;
    }

    try {
      const url = await upload(file, kind);
      if (kind === 'logo') setLogoUrl(url); else setBannerUrl(url);
      toast({
        title: 'Image uploaded',
        description: 'Compressed and stored on our own server. It was made available to the media API, and you have pressed Apply Changes to save it.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!sellerShopRef || !user || !userProfile) return;
    setIsSaving(true);

    try {
      ensureSocialLinksSaved();
    } catch {
      // Links save failed; the toast is already shown. Keep the rest.
    }

    // Deduct points for new target markets, exactly as the app account screen
    // does — the seller pays for each new market they want to reach.
    const existing = shopData?.targetLocations ?? [];
    const added = targetLocations.filter((loc) => !existing.includes(loc));
    const pointsToDeduct = added.length * POINT_COST_PER_TARGET;

    if (pointsToDeduct > (userProfile.aiPoints ?? 0)) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Points',
        description: `Adding ${added.length} new target location${added.length === 1 ? '' : 's'} costs ${pointsToDeduct} points. You only have ${userProfile.aiPoints}.`,
      });
      setIsSaving(false);
      return;
    }

    try {
      const batch = writeBatch(firestore);

      // The storefront and profile must never disagree about the shop's name or
      // logo, so both are written in one batch.
      batch.set(
        sellerShopRef,
        {
          shopName: shopName.trim(),
          description: shopDescription.trim(),
          category: category.trim(),
          logoUrl: logoUrl ?? '',
          bannerUrl: bannerUrl ?? '',
          contactWhatsapp: contactWhatsapp.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          location: [area, subCounty, county, country].filter(Boolean).join(', ') || 'Global',
          country: country.trim(),
          county: county.trim(),
          subCounty: subCounty.trim(),
          area: area.trim(),
          targetLocations,
          storeHours: storeHours.trim(),
          returnPolicy: returnPolicy.trim(),
          deliveryPolicy: deliveryPolicy.trim(),
          socialLinks: socialLinks.map((l) => ({ id: l.id, label: l.label, url: l.url })),
        },
        { merge: true },
      );
      batch.set(
        doc(firestore, 'userProfiles', user.uid),
        {
          shopName: shopName.trim(),
          username: shopName.trim() || userProfile?.username,
          profilePictureUrl: logoUrl ?? '',
          location: [area, subCounty, county, country].filter(Boolean).join(', ') || 'Global',
        },
        { merge: true },
      );
      if (pointsToDeduct > 0) {
        batch.set(
          doc(firestore, 'userProfiles', user.uid),
          { aiPoints: increment(-pointsToDeduct) },
          { merge: true },
        );
      }
      await batch.commit();
      toast({
        title: 'Settings saved',
        description: pointsToDeduct > 0
          ? `Deducted ${pointsToDeduct} points for new target markets.`
          : 'Changes applied successfully.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save your settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Shop Config</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Manage global presence and logistics</p>
          </div>

          <div className="flex items-center gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-md">
                  <BadgeCent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">My Points</p>
                  <p className="text-lg font-black text-primary">{(userProfile?.aiPoints || 0).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving || !!isUploading}
              className="font-black uppercase tracking-widest px-8 h-12 shadow-xl shadow-primary/20"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : 'Apply Changes'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="bg-muted/50 p-1 mb-4">
            <TabsTrigger value="profile"><Store className="mr-2 h-4 w-4" /> Branding & Contact</TabsTrigger>
            <TabsTrigger value="logistics"><Globe className="mr-2 h-4 w-4" /> Logistics & Target Market</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Store Branding</CardTitle><CardDescription>Update your shop's visual identity.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Shop Name</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} /></div>

                {/* Category — makes your shop reachable by the same buyers as the app account screen. */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {REQUEST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Decides which customer briefs reach you. The single most valuable setting on this screen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Logo (Circular Profile)</Label>
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={(e) => handleFileChange(e, 'logo')}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                    />
                    {logoUrl ? (
                      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary/20">
                        <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full"
                          onClick={() => setLogoUrl(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-32 border-dashed rounded-xl"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={!!isUploading}
                      >
                        <UploadCloud className="mr-2" />Upload Logo
                      </Button>
                    )}
                    {isUploading === 'logo' && <Progress value={uploadProgress} className="h-1 mt-2" />}
                    <p className="text-[11px] text-muted-foreground">
                      Square works best — it is shown as a circle.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Banner (Wide Hero)</Label>
                    <input
                      type="file"
                      ref={bannerInputRef}
                      onChange={(e) => handleFileChange(e, 'banner')}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                    />
                    {bannerUrl ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/20">
                        <Image src={bannerUrl} alt="Banner" fill className="object-cover" />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => setBannerUrl(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-32 border-dashed rounded-xl"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={!!isUploading}
                      >
                        <UploadCloud className="mr-2" />Upload Banner
                      </Button>
                    )}
                    {isUploading === 'banner' && <Progress value={uploadProgress} className="h-1 mt-2" />}
                    <p className="text-[11px] text-muted-foreground">
                      Wide — roughly 3:1. This sits behind your logo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Public Contact Info</CardTitle><CardDescription>Information shown to buyers on your shop profile.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Support Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="help@yourstore.com" /></div>
                <div className="space-y-2"><Label className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Business Phone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+254..." /></div>
                <div className="space-y-2"><Label className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-500" /> WhatsApp Number</Label><Input value={contactWhatsapp} onChange={e => setContactWhatsapp(e.target.value)} placeholder="For direct buyer chats" /></div>
              </CardContent>
            </Card>

            {/* Social links — same editor the app account screen uses, same free-form
                list contract, so a seller's TikTok / Telegram / WhatsApp links are saved
                the same way everywhere. */}
            <Card>
              <CardHeader><CardTitle>Social Media Links</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <SocialLinksEditor
                  initialLinks={socialLinksFromShop}
                  onSave={saveSocialLinks}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="text-primary" /> About Seller & Logistics</CardTitle>
                <CardDescription>Define your location and your store's mission. This is visible to all buyers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Store Description / Bio</Label>
                  <Textarea
                    rows={5}
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    placeholder="Introduce your store. What makes you unique?"
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Shop Physical Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Kenya, Nigeria, USA" />
                    </div>
                    <div className="space-y-2">
                      <Label>County / State / Province</Label>
                      <Input value={county} onChange={e => setCounty(e.target.value)} placeholder="e.g. Nairobi, Lagos, California" />
                    </div>
                    <div className="space-y-2">
                      <Label>Sub-County / City / Town</Label>
                      <Input value={subCounty} onChange={e => setSubCounty(e.target.value)} placeholder="e.g. Westlands, Ikeja, Los Angeles" />
                    </div>
                    <div className="space-y-2">
                      <Label>Specific Area / Street Address</Label>
                      <Input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. 5th Avenue, CBD, Highway 101" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><Target className="h-4 w-4" /> Target Markets</h3>
                  <p className="text-xs text-muted-foreground">Select the cities or countries where you want your products to be shown first. Use <span className="text-primary font-bold">10 AI points</span> to add a new target location.</p>
                  <div className="flex gap-2">
                    <Input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Add a city or country..." className="max-w-xs" />
                    <Button variant="secondary" onClick={addTarget}><Plus className="h-4 w-4 mr-2" /> Add Target</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {targetLocations.map(loc => (
                      <Badge key={loc} variant="outline" className="pl-3 pr-1 py-1 h-8 gap-2 bg-primary/5 border-primary/20">
                        {loc}
                        <button onClick={() => removeTarget(loc)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                    {targetLocations.length === 0 && <p className="text-sm text-muted-foreground italic">No specific target markets set. Your products will show globally.</p>}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2"><Label>Opening Hours</Label><Input value={storeHours} onChange={e => setStoreHours(e.target.value)} placeholder="e.g. 9 AM - 6 PM, Mon-Sat" /></div>
                  <div className="space-y-2"><Label>Return Policy</Label><Textarea value={returnPolicy} onChange={e => setReturnPolicy(e.target.value)} placeholder="Describe your terms for returns and refunds." /></div>
                  <div className="space-y-2"><Label>Delivery Policy</Label><Textarea value={deliveryPolicy} onChange={e => setDeliveryPolicy(e.target.value)} placeholder="How long does shipping take? Which couriers do you use?" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
