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
  Link as LinkIcon,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  QrCode,
  Download,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUser, useFirestore, useMemoFirebase, useUserProfile, errorEmitter } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { SellerShop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { getTikTokAuthUrl } from '@/lib/tiktok';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';

const passwordFormSchema = z.object({
  oldPassword: z.string().min(1, { message: "Old password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


export default function SellerSettingsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const auth = getAuth();
  
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

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
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [shopUrl, setShopUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (shopData) {
        setShopName(shopData.shopName || '');
        setShopDescription(shopData.description || '');
        setLogoUrl(shopData.logoUrl || null);
        setBannerUrl(shopData.bannerUrl || null);
    }
  }, [shopData]);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
        setShopUrl(`${window.location.origin}/sellers/${user.uid}`);
    }
  }, [user]);
  
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
    });

  async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Not logged in or email not found.' });
      return;
    }
    setIsPasswordSaving(true);
    
    const credential = EmailAuthProvider.credential(user.email, values.oldPassword);
    
    try {
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, values.newPassword);
      toast({ title: 'Success', description: 'Your password has been updated.' });
      passwordForm.reset();
    } catch (error: any) {
      console.error("Password update error:", error);
      let description = "An error occurred. Please try again.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "The old password you entered is incorrect.";
      }
      toast({ variant: 'destructive', title: 'Password Update Failed', description });
    } finally {
      setIsPasswordSaving(false);
    }
  }


  const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const paramsToSign = { timestamp, folder: 'avatars' };

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
    formData.append('folder', 'avatars');

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Cloudinary upload failed.');
    
    const uploadedData = await response.json();
    return uploadedData.secure_url;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(type);
      try {
          const  url  = await uploadToCloudinary(file);
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
  
    const handleDisconnectTikTok = async () => {
        if (!user || !firestore) return;

        const userRef = doc(firestore, 'userProfiles', user.uid);
        try {
            await updateDoc(userRef, { 'connections.tiktok': null });
            toast({ title: 'TikTok Disconnected', description: 'Your account has been unlinked.' });
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { 'connections.tiktok': null },
            }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not disconnect your account.' });
        }
    };

    const handleDownload = async () => {
        if (!shopUrl) return;
        setIsDownloading(true);
        try {
            const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(shopUrl)}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${userProfile?.username || 'shop'}-qr-code.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: 'Download Started', description: 'Your QR code is being downloaded.' });
        } catch (error) {
            console.error('Failed to download QR code:', error);
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not download the QR code.' });
        } finally {
            setIsDownloading(false);
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
             <TabsTrigger value="connections">
              <LinkIcon className="mr-2 h-4 w-4" /> Connections
            </TabsTrigger>
             <TabsTrigger value="qr-code">
              <QrCode className="mr-2 h-4 w-4" /> QR Code
            </TabsTrigger>
            <TabsTrigger value="location">
              <MapPin className="mr-2 h-4 w-4" /> Location
            </TabsTrigger>
            <TabsTrigger value="contact">
              <Mail className="mr-2 h-4 w-4" /> Contact
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

          {/* QR Code Tab */}
          <TabsContent value="qr-code" className="space-y-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Shop QR Code</CardTitle>
                      <CardDescription>
                          Download a QR code that links directly to your shop. Perfect for business cards, flyers, and offline marketing.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-6">
                      {shopUrl ? (
                          <div className="p-4 bg-white rounded-lg">
                              <Image
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(shopUrl)}`}
                                  alt="Your Shop QR Code"
                                  width={256}
                                  height={256}
                              />
                          </div>
                      ) : (
                          <Skeleton className="h-[256px] w-[256px]" />
                      )}
                      <Button onClick={handleDownload} disabled={!shopUrl || isDownloading}>
                          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                          Download QR Code
                      </Button>
                  </CardContent>
              </Card>
          </TabsContent>

          {/* Connections Tab */}
            <TabsContent value="connections" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>App Connections</CardTitle>
                    <CardDescription>Connect your social media accounts to enable powerful cross-platform features.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isProfileLoading ? (
                        <p>Loading connection status...</p>
                    ) : userProfile?.connections?.tiktok?.accessToken ? (
                        <div className="flex items-center justify-between rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-500/20 rounded-lg">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <Label className="text-lg font-bold text-green-300">TikTok Connected</Label>
                                    <p className="text-sm text-green-300/80">
                                        Your account is ready to post videos directly to TikTok.
                                    </p>
                                </div>
                            </div>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">Disconnect</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Disconnecting your TikTok account will prevent Go Earn from posting on your behalf. You can reconnect at any time.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDisconnectTikTok}>
                                            Disconnect
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-black rounded-lg border border-neutral-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 0 .15.02.22.04.53.15 1.02.44 1.43.82.38.35.66.78.85 1.25.08.2.13.4.14.61.01 1.3.02 2.6.02 3.91s-.01 2.61-.02 3.91c0 .08-.02.15-.04.22-.15.53-.44 1.02-.82 1.43-.35.38-.78.66-1.25.85-.2.08-.4.13-.61.14-1.3.01-2.6.02-3.91.02s-2.61-.01-3.91-.02c-.08 0-.15-.02-.22-.04-.53-.15-1.02-.44-1.43-.82-.38-.35-.66-.78-.85-1.25-.08-.2-.13-.4-.14-.61-.01-1.3-.02-2.6-.02-3.91s.01-2.61.02-3.91c0-.08.02-.15.04-.22.15-.53.44 1.02.82-1.43.35-.38.78-.66 1.25-.85.2-.08.4-.13.61-.14 1.3-.01 2.6-.02 3.91-.02zM12 15.35c-1.85 0-3.35-1.5-3.35-3.35s1.5-3.35 3.35-3.35 3.35 1.5 3.35 3.35-1.5 3.35-3.35 3.35zM12 10.1c-1.05 0-1.9.85-1.9 1.9s.85 1.9 1.9 1.9 1.9-.85 1.9-1.9-.85-1.9-1.9-1.9z" fill="white" /><path d="M16.95 3.05a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" fill="white" /></svg>
                                </div>
                                <div>
                                    <Label className="text-lg font-bold">TikTok</Label>
                                    <p className="text-sm text-muted-foreground">Allow Go Earn to post boosted videos directly to your TikTok account.</p>
                                </div>
                            </div>
                             <Button asChild>
                                <a href={getTikTokAuthUrl(user?.uid || '')}>Connect with TikTok</a>
                            </Button>
                        </div>
                    )}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage your password and account security settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                        <h3 className="text-lg font-medium">Change Password</h3>
                        <div className="space-y-4 mt-4">
                            <FormField
                                control={passwordForm.control}
                                name="oldPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Old Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={passwordForm.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={passwordForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm New Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit" disabled={isPasswordSaving}>
                                {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Password
                            </Button>
                        </div>
                    </form>
                 </Form>
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
                        defaultValue="We accept returns within 7 days for a full refund. Items must be in unused and in original packaging. Buyer pays return shipping." 
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
