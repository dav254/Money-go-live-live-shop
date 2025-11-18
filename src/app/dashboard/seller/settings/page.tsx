
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Building,
  Palette,
  FileText,
  Lock,
  Mail,
  MapPin,
  Store,
  UploadCloud,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { SellerShop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

type AccentColor = 'red' | 'blue' | 'purple' | 'gold' | 'pink';
type ButtonStyle = 'rounded' | 'square' | 'soft';

export default function SellerSettingsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const sellerShopRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'sellerShops', user.uid);
  }, [firestore, user]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);

  // Profile State
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<'logo' | 'banner' | null>(null);

  // Theme State
  const [darkMode, setDarkMode] = useState(true);
  const [accentColor, setAccentColor] = useState<AccentColor>('red');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>('rounded');
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (shopData) {
        setShopName(shopData.shopName || '');
        setShopDescription(shopData.description || '');
        setLogoUrl(shopData.logoUrl || null);
        setBannerUrl(shopData.bannerUrl || null);

        if (shopData.themeSettings) {
            setDarkMode(shopData.themeSettings.darkMode ?? true);
            setAccentColor(shopData.themeSettings.accentColor ?? 'red');
            setButtonStyle(shopData.themeSettings.buttonStyle ?? 'rounded');
        }
    }
  }, [shopData]);


  const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const paramsToSign = { timestamp };
    
    const signatureResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
    });
    const { signature } = await signatureResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!response.ok) {
        throw new Error('Cloudinary upload failed.');
    }
    const uploadedData = await response.json();
    return { url: uploadedData.secure_url, type: file.type };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(type);
      try {
          const { url } = await uploadToCloudinary(file);
          if (type === 'logo') {
              setLogoUrl(url);
          } else {
              setBannerUrl(url);
          }
          toast({ title: `${type === 'logo' ? 'Logo' : 'Banner'} uploaded!` });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload your image.' });
      } finally {
          setIsUploading(null);
      }
  };


  const handleSaveChanges = async () => {
    if (!sellerShopRef) return;
    setIsSaving(true);
    
    const dataToSave: Partial<SellerShop> = {
        shopName,
        description: shopDescription,
        logoUrl: logoUrl || '',
        bannerUrl: bannerUrl || '',
        themeSettings: {
            darkMode,
            accentColor,
            buttonStyle
        }
    };

    try {
        await setDoc(sellerShopRef, dataToSave, { merge: true });
        toast({
            title: 'Settings Saved!',
            description: 'Your shop settings have been updated.',
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not save your settings. Please try again.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Shop Settings
            </h1>
            <Button onClick={handleSaveChanges} disabled={isSaving || isUploading !== null}>
                {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
        </div>
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <Store className="mr-2 h-4 w-4" /> Shop Profile
            </TabsTrigger>
            <TabsTrigger value="location">
              <MapPin className="mr-2 h-4 w-4" /> Location
            </TabsTrigger>
            <TabsTrigger value="contact">
              <Mail className="mr-2 h-4 w-4" /> Contact
            </TabsTrigger>
            <TabsTrigger value="theme">
              <Palette className="mr-2 h-4 w-4" /> Theme
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="mr-2 h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="policies">
              <FileText className="mr-2 h-4 w-4" /> Policies
            </TabsTrigger>
          </TabsList>
          
          {/* Shop Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Shop Profile</CardTitle>
                <CardDescription>
                  Customize your store's identity and branding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="shop-name">Shop Name</Label>
                  <Input id="shop-name" placeholder="e.g., Aisha's Handbags" value={shopName} onChange={(e) => setShopName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop-description">Shop Description</Label>
                  <Textarea id="shop-description" placeholder="Tell customers about your shop..." value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Shop Logo (1:1 ratio)</Label>
                        <input type="file" ref={logoInputRef} onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="hidden" />
                        {logoUrl ? (
                            <div className="relative w-48 h-48 rounded-md overflow-hidden">
                                <Image src={logoUrl} alt="Logo preview" fill className="object-cover" />
                                <Button size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => setLogoUrl(null)}>Remove</Button>
                            </div>
                        ) : (
                             <Button variant="outline" className="w-full h-32 border-dashed" onClick={() => logoInputRef.current?.click()} disabled={isUploading === 'logo'}>
                                {isUploading === 'logo' ? 'Uploading...' : <><UploadCloud className="mr-2" /> Upload Logo</>}
                            </Button>
                        )}
                    </div>
                     <div className="space-y-2">
                        <Label>Shop Banner (3:1 ratio)</Label>
                        <input type="file" ref={bannerInputRef} onChange={(e) => handleFileChange(e, 'banner')} accept="image/*" className="hidden" />
                        {bannerUrl ? (
                             <div className="relative w-full aspect-[3/1] rounded-md overflow-hidden">
                                <Image src={bannerUrl} alt="Banner preview" fill className="object-cover" />
                                <Button size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => setBannerUrl(null)}>Remove</Button>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full h-32 border-dashed" onClick={() => bannerInputRef.current?.click()} disabled={isUploading === 'banner'}>
                                {isUploading === 'banner' ? 'Uploading...' : <><UploadCloud className="mr-2" /> Upload Banner</>}
                            </Button>
                        )}
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Location</CardTitle>
                <CardDescription>
                  Help customers know where you are based.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" defaultValue="Kenya" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">County / City</Label>
                        <Input id="city" placeholder="e.g., Nairobi" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address">Building & Floor / Exact Area</Label>
                    <Input id="address" placeholder="e.g., ABC Towers, 3rd Floor" />
                </div>
                 <div className="h-64 w-full rounded-md bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">Google Map Preview</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact & WhatsApp</CardTitle>
                <CardDescription>
                  Manage how buyers can contact you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Primary Phone</Label>
                        <Input id="phone" type="tel" placeholder="+254 712 345 678" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp Number</Label>
                        <Input id="whatsapp" type="tel" placeholder="+254 712 345 678" />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Public Email</Label>
                    <Input id="email" type="email" placeholder="support@aishabags.co.ke" />
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label>Social Media Links</Label>
                    <Input placeholder="TikTok Profile URL" />
                    <Input placeholder="Instagram Profile URL" />
                    <Input placeholder="Facebook Page URL" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Customization Tab */}
          <TabsContent value="theme" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Theme Customization</CardTitle>
                <CardDescription>
                  Personalize the look and feel of your shop page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <Switch id="dark-mode" checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
                 <div>
                  <Label>Accent Color</Label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(['red', 'blue', 'purple', 'gold', 'pink'] as AccentColor[]).map(color => (
                         <Button key={color} variant={accentColor === color ? 'default' : 'outline'} onClick={() => setAccentColor(color)} className="capitalize">{color}</Button>
                    ))}
                  </div>
                </div>
                 <div>
                  <Label>Button Style</Label>
                    <RadioGroup value={buttonStyle} onValueChange={(val) => setButtonStyle(val as ButtonStyle)} className="flex gap-4 pt-2">
                        {(['rounded', 'square', 'soft'] as ButtonStyle[]).map(style => (
                            <div key={style} className="flex items-center space-x-2">
                                <RadioGroupItem value={style} id={style} />
                                <Label htmlFor={style} className="capitalize">{style}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage your account security settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                        <Label>Password</Label>
                        <p className="text-sm text-muted-foreground">Manage your account password.</p>
                    </div>
                    <Button variant="outline">Change Password</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Shop Policies</CardTitle>
                <CardDescription>
                  Set clear expectations for your customers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="return-policy">Return & Refund Policy</Label>
                    <Textarea 
                        id="return-policy" 
                        rows={6} 
                        defaultValue="We accept returns within 7 days for a full refund. Items must be unused and in original packaging. Buyer pays for return shipping." 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="shipping-policy">Delivery & Shipping Policy</Label>
                    <Textarea 
                        id="shipping-policy" 
                        rows={4} 
                        defaultValue="We ship nationwide via G4S within 2-3 business days. Same-day delivery available in Nairobi for KES 300 via local riders." 
                    />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
