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
  Facebook,
  Instagram,
  Twitter,
  Phone,
  Globe,
  Info,
} from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useUserProfile } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { SellerShop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kenyaLocations } from '@/lib/location-data';

export default function SellerSettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const { userProfile } = useUserProfile(user?.uid);
  const sellerShopRef = useMemoFirebase(() => user ? doc(firestore, 'sellerShops', user.uid) : null, [firestore, user]);
  const { data: shopData } = useDoc<SellerShop>(sellerShopRef);

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<'logo' | 'banner' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // URLs & Contact Info
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  // Structured Logistics
  const [country, setCountry] = useState('Kenya');
  const [county, setCounty] = useState('');
  const [subCounty, setSubCounty] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [cityTown, setCityTown] = useState('');
  const [area, setArea] = useState('');
  
  const [storeHours, setStoreHours] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [deliveryPolicy, setDeliveryPolicy] = useState('');

  useEffect(() => {
    if (shopData) {
        setShopName(shopData.shopName || '');
        setShopDescription(shopData.description || '');
        setLogoUrl(shopData.logoUrl || null);
        setBannerUrl(shopData.bannerUrl || null);
        setFacebookUrl(shopData.facebookUrl || '');
        setInstagramUrl(shopData.instagramUrl || '');
        setTwitterUrl(shopData.twitterUrl || '');
        setContactWhatsapp(shopData.contactWhatsapp || '');
        setContactPhone(shopData.contactPhone || '');
        setContactEmail(shopData.contactEmail || '');
        
        setCountry(shopData.country || 'Kenya');
        setCounty(shopData.county || '');
        setSubCounty(shopData.subCounty || '');
        setStateProvince(shopData.stateProvince || '');
        setCityTown(shopData.cityTown || '');
        setArea(shopData.area || '');
        
        setStoreHours(shopData.storeHours || '');
        setReturnPolicy(shopData.returnPolicy || '');
        setDeliveryPolicy(shopData.deliveryPolicy || '');
    }
  }, [shopData]);

  const uploadToFirebase = (file: File, type: 'logo' | 'banner'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storage = getStorage();
      const storageRef = ref(storage, `shops/${user?.uid}/${type}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      setIsUploading(type);
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
            setIsUploading(null);
            reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((url) => {
            setIsUploading(null);
            setUploadProgress(0);
            resolve(url);
          });
        }
      );
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
          const url = await uploadToFirebase(file, type);
          if (type === 'logo') setLogoUrl(url); else setBannerUrl(url);
          toast({ title: 'Image uploaded!' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload failed' });
      }
  };

  const handleSaveChanges = async () => {
    if (!sellerShopRef || !user) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        let locationString = '';
        
        if (country === 'Kenya') {
            locationString = area && county ? `${area}, ${county}, Kenya` : (area || county || 'Kenya');
        } else {
            locationString = cityTown && country ? `${cityTown}, ${country}` : (cityTown || country || 'International');
        }
        
        const shopUpdate = { 
            shopName, 
            description: shopDescription, 
            logoUrl: logoUrl || '', 
            bannerUrl: bannerUrl || '',
            facebookUrl,
            instagramUrl,
            twitterUrl,
            contactWhatsapp,
            contactPhone,
            contactEmail,
            location: locationString,
            country,
            county: country === 'Kenya' ? county : '',
            subCounty: country === 'Kenya' ? subCounty : '',
            stateProvince: country !== 'Kenya' ? stateProvince : '',
            cityTown: country !== 'Kenya' ? cityTown : '',
            area,
            storeHours,
            returnPolicy,
            deliveryPolicy
        };
        batch.set(sellerShopRef, shopUpdate, { merge: true });
        batch.update(doc(firestore, 'userProfiles', user.uid), { 
            shopName, 
            username: shopName || userProfile?.username, 
            profilePictureUrl: logoUrl || '',
            location: locationString
        });
        await batch.commit();
        toast({ title: 'Settings Saved!' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error saving settings' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Shop Config</h1>
            <Button onClick={handleSaveChanges} disabled={isSaving || !!isUploading} className="font-black uppercase tracking-widest px-8 h-12 shadow-xl shadow-primary/20">
                {isSaving ? <Loader2 className="animate-spin" /> : 'Apply Changes'}
            </Button>
        </div>
        <Tabs defaultValue="profile">
          <TabsList className="bg-muted/50 p-1 mb-4">
            <TabsTrigger value="profile"><Store className="mr-2 h-4 w-4" /> Branding & Contact</TabsTrigger>
            <TabsTrigger value="logistics"><Globe className="mr-2 h-4 w-4" /> Logistics & About</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Store Branding</CardTitle><CardDescription>Update your shop's visual identity.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Shop Name</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Logo (Circular Profile)</Label>
                        <input type="file" ref={logoInputRef} onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="hidden" />
                        {logoUrl ? (
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary/20">
                                <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setLogoUrl(null)}><X className="h-3 w-3"/></Button>
                            </div>
                        ) : <Button variant="outline" className="w-full h-32 border-dashed rounded-xl" onClick={() => logoInputRef.current?.click()} disabled={!!isUploading}><UploadCloud className="mr-2" />Upload Logo</Button>}
                        {isUploading === 'logo' && <Progress value={uploadProgress} className="h-1 mt-2" />}
                    </div>
                    <div className="space-y-2">
                        <Label>Banner (Wide Hero)</Label>
                        <input type="file" ref={bannerInputRef} onChange={(e) => handleFileChange(e, 'banner')} accept="image/*" className="hidden" />
                        {bannerUrl ? (
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/20">
                                <Image src={bannerUrl} alt="Banner" fill className="object-cover" />
                                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => setBannerUrl(null)}><X className="h-3 w-3"/></Button>
                            </div>
                        ) : <Button variant="outline" className="w-full h-32 border-dashed rounded-xl" onClick={() => bannerInputRef.current?.click()} disabled={!!isUploading}><UploadCloud className="mr-2" />Upload Banner</Button>}
                        {isUploading === 'banner' && <Progress value={uploadProgress} className="h-1 mt-2" />}
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

            <Card>
                <CardHeader><CardTitle>Social Media Links</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2"><Label className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-600" /> Facebook</Label><Input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." /></div>
                    <div className="space-y-2"><Label className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-600" /> Instagram</Label><Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="@yourstore" /></div>
                    <div className="space-y-2"><Label className="flex items-center gap-2"><Twitter className="h-4 w-4 text-sky-500" /> Twitter (X)</Label><Input value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} placeholder="@yourstore" /></div>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Info className="text-primary" /> About Seller</CardTitle>
                    <CardDescription>Tell your story and define your business presence. This info is visible on all your products and live shows.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Store Description / Bio</Label>
                        <Textarea 
                            rows={5} 
                            value={shopDescription} 
                            onChange={(e) => setShopDescription(e.target.value)} 
                            placeholder="Introduce your store to potential buyers. What makes you unique?"
                        />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Shop Location</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Country</Label>
                                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Kenya, Nigeria, USA" />
                            </div>
                            
                            {country === 'Kenya' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label>County</Label>
                                        <Select value={county} onValueChange={(val) => { setCounty(val); setSubCounty(''); }}>
                                            <SelectTrigger><SelectValue placeholder="Select County" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(kenyaLocations).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sub-County</Label>
                                        <Select value={subCounty} onValueChange={setSubCounty} disabled={!county}>
                                            <SelectTrigger><SelectValue placeholder="Select Sub-County" /></SelectTrigger>
                                            <SelectContent>
                                                {county && kenyaLocations[county]?.map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label>State / Province</Label>
                                        <Input value={stateProvince} onChange={e => setStateProvince(e.target.value)} placeholder="e.g. Lagos, California" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>City / Town</Label>
                                        <Input value={cityTown} onChange={e => setCityTown(e.target.value)} placeholder="e.g. Ikeja, Los Angeles" />
                                    </div>
                                </>
                            )}
                            
                            <div className="space-y-2">
                                <Label>Specific Area / Street Address</Label>
                                <Input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Westlands, CBD, 5th Avenue" />
                            </div>
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
