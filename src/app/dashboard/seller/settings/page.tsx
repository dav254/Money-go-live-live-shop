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

  useEffect(() => {
    if (shopData) {
        setShopName(shopData.shopName || '');
        setShopDescription(shopData.description || '');
        setLogoUrl(shopData.logoUrl || null);
        setBannerUrl(shopData.bannerUrl || null);
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
        const shopUpdate = { shopName, description: shopDescription, logoUrl: logoUrl || '', bannerUrl: bannerUrl || '' };
        batch.set(sellerShopRef, shopUpdate, { merge: true });
        batch.update(doc(firestore, 'userProfiles', user.uid), { shopName, username: shopName, profilePictureUrl: logoUrl || '' });
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
            <h1 className="font-headline text-3xl font-bold tracking-tight">Shop Settings</h1>
            <Button onClick={handleSaveChanges} disabled={isSaving || !!isUploading}>
                {isSaving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
            </Button>
        </div>
        <Tabs defaultValue="profile">
          <TabsList><TabsTrigger value="profile"><Store className="mr-2 h-4 w-4" /> Shop Profile</TabsTrigger></TabsList>
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Profile Branding</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Shop Name</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Logo</Label>
                        <input type="file" ref={logoInputRef} onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="hidden" />
                        {logoUrl ? (
                            <div className="relative w-32 h-32 rounded-md overflow-hidden border">
                                <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => setLogoUrl(null)}><X className="h-3 w-3"/></Button>
                            </div>
                        ) : <Button variant="outline" className="w-full h-32 border-dashed" onClick={() => logoInputRef.current?.click()} disabled={!!isUploading}><UploadCloud className="mr-2" />Logo</Button>}
                        {isUploading === 'logo' && <Progress value={uploadProgress} className="h-1 mt-2" />}
                    </div>
                    <div className="space-y-2">
                        <Label>Banner</Label>
                        <input type="file" ref={bannerInputRef} onChange={(e) => handleFileChange(e, 'banner')} accept="image/*" className="hidden" />
                        {bannerUrl ? (
                            <div className="relative w-full aspect-video rounded-md overflow-hidden border">
                                <Image src={bannerUrl} alt="Banner" fill className="object-cover" />
                                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => setBannerUrl(null)}><X className="h-3 w-3"/></Button>
                            </div>
                        ) : <Button variant="outline" className="w-full h-32 border-dashed" onClick={() => bannerInputRef.current?.click()} disabled={!!isUploading}><UploadCloud className="mr-2" />Banner</Button>}
                        {isUploading === 'banner' && <Progress value={uploadProgress} className="h-1 mt-2" />}
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
