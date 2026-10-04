'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';
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
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Lock, User, Loader2, ShieldCheck, UploadCloud, File as FileIcon, X, MapPin, RefreshCw, Palette, Sun, Moon, Monitor, LifeBuoy, Store } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import type { UserProfile } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';
import { detectLocation, saveLocationToStorage, getLocationFromStorage, type UserLocation } from '@/lib/location-detection';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useTheme } from 'next-themes';
import { SecurityAndSessions } from '@/components/account/security-and-sessions';
import { AccountSupport } from '@/components/account/account-support';
import { AccountShopProfile } from '@/components/account/account-shop-profile';

const profileFormSchema = z.object({
    fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
    username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
    phoneNumber: z.string().optional(),
    bio: z.string().max(180, "Bio cannot be longer than 180 characters").optional(),
    location: z.string().optional(),
});

interface SubComponentProps {
    user: FirebaseUser | null;
    userProfile: UserProfile | null;
    isLoading: boolean;
}

const SellerVerificationForm = ({ user, userProfile, isLoading: isProfileLoading }: SubComponentProps) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const handleFileRemove = (fileName: string) => {
        setFiles(prev => prev.filter(file => file.name !== fileName));
    };

    const uploadToFirebase = async (file: File): Promise<string> => {
      const storage = getStorage();
      const storageRef = ref(storage, `verification/${user?.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
              (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              }, 
              (error) => reject(error), 
              () => {
                  getDownloadURL(uploadTask.snapshot.ref).then(resolve);
              }
          );
      });
    };
    
    const handleSubmitForVerification = async () => {
        if (!user || !firestore) return;
        if (files.length === 0) {
            toast({ variant: 'destructive', title: 'No files selected' });
            return;
        }

        setIsUploading(true);
        try {
            await Promise.all(files.map(file => uploadToFirebase(file)));
            await updateDoc(doc(firestore, 'userProfiles', user.uid), { verificationStatus: 'pending' });
            toast({ title: 'Submitted!', description: 'Verification request sent.' });
            setFiles([]);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setIsUploading(false);
            setUploadProgress({});
        }
    };
    
    if (isProfileLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

    if (userProfile?.verificationStatus === 'verified') {
        return (
            <Alert className="bg-green-600/10 border-green-600/50 text-green-300">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <AlertTitle>Verified Seller</AlertTitle>
                <AlertDescription>Your account is verified. You have full access to platform features.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>Verification Documents</Label>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} disabled={isUploading} />
                <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <UploadCloud className="mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload Docs (ID, Business Permit)'}
                </Button>
            </div>
            {files.length > 0 && (
                <div className="space-y-4">
                    {files.map(file => (
                        <div key={file.name} className="flex items-center gap-3 rounded-md border p-2">
                            <FileIcon className="h-6 w-6" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">{file.name}</p>
                                <Progress value={uploadProgress[file.name] || 0} className="h-1 mt-1" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleFileRemove(file.name)} disabled={isUploading}><X className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
            )}
            <Button onClick={handleSubmitForVerification} disabled={isUploading || files.length === 0}>
                {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Submit for Verification
            </Button>
        </div>
    );
};

const AccountSettingsContent = ({ user, userProfile, isLoading: isProfileLoading }: SubComponentProps) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { theme, setTheme } = useTheme();
    const [isProfileSaving, setIsProfileSaving] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    const [isDetecting, setIsDetecting] = useState(false);

    // Deep-linkable tab: /dashboard/account?tab=security|shop|support…
    const searchParams = useSearchParams();
    const initialTab = searchParams?.get('tab');
    const [tab, setTab] = useState<string>(
        initialTab && ['profile', 'appearance', 'verification', 'shop', 'security', 'support'].includes(initialTab)
            ? initialTab
            : 'profile',
    );

    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            fullName: userProfile?.fullName || '',
            username: userProfile?.username || '',
            phoneNumber: userProfile?.phoneNumber || '',
            bio: userProfile?.bio || '',
            location: userProfile?.location || '',
        }
    });

    useEffect(() => {
        if (userProfile) {
            profileForm.reset({
                fullName: userProfile.fullName || '',
                username: userProfile.username || '',
                phoneNumber: userProfile.phoneNumber || '',
                bio: userProfile.bio || '',
                location: userProfile.location || '',
            });
            setAvatarUrl(userProfile.profilePictureUrl || null);
        }
    }, [userProfile, profileForm]);

    const uploadAvatar = async (file: File) => {
        const storage = getStorage();
        const storageRef = ref(storage, `avatars/${user?.uid}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        setIsUploading(true);
        uploadTask.on('state_changed', 
            (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            (error) => {
                toast({ variant: 'destructive', title: 'Upload Failed' });
                setIsUploading(false);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                    setAvatarUrl(url);
                    setIsUploading(false);
                    setUploadProgress(0);
                });
            }
        );
    };

    const handleDetectLocation = async () => {
        setIsDetecting(true);
        try {
            const detected = await detectLocation();
            const locationString = `${detected.city.toUpperCase()}, ${detected.country.toUpperCase()}`;
            profileForm.setValue('location', locationString);
            saveLocationToStorage(detected);
            toast({ title: 'Location Detected', description: `Your current location is set to ${locationString}.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Detection Failed', description: 'Could not automatically detect your location.' });
        } finally {
            setIsDetecting(false);
        }
    };

    const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
        if (!user) return;
        setIsProfileSaving(true);
        try {
            const profileData = {
                ...values,
                profilePictureUrl: avatarUrl,
            };
            await updateDoc(doc(firestore, 'userProfiles', user.uid), profileData);
            toast({ title: 'Profile Updated!' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'There was an error updating your profile.' });
        } finally {
            setIsProfileSaving(false);
        }
    };

    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Account & Preferences</h1>
        <Tabs defaultValue="profile" value={tab} onValueChange={(v) => setTab(v)} className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" /> My Profile</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</TabsTrigger>
            {userProfile?.userRole === 'seller' && <TabsTrigger value="verification"><ShieldCheck className="mr-2 h-4 w-4" /> Verification</TabsTrigger>}
            {userProfile?.userRole === 'seller' && <TabsTrigger value="shop"><Store className="mr-2 h-4 w-4" /> Shop</TabsTrigger>}
            <TabsTrigger value="security"><Lock className="mr-2 h-4 w-4" /> Security &amp; Sessions</TabsTrigger>
            <TabsTrigger value="support"><LifeBuoy className="mr-2 h-4 w-4" /> Support</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardHeader>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>Update your personal information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-20 w-20 border-2 border-primary/20">
                                    <AvatarImage src={avatarUrl || getPlaceholderImage()} />
                                    <AvatarFallback>{userProfile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                    <input type="file" ref={avatarInputRef} onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} accept="image/*" className="hidden" />
                                    <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                        Change Picture
                                    </Button>
                                    {isUploading && <Progress value={uploadProgress} className="h-1 mt-2" />}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={profileForm.control} name="username" render={({ field }) => (
                                    <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="fullName" render={({ field }) => (
                                    <FormItem><FormLabel>Display Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} placeholder="+254 712 345 678" /></FormControl><FormMessage /></FormItem>
                                )} />
                                
                                <div className="space-y-2">
                                    <Label>Presence & Presence</Label>
                                    <button 
                                        type="button"
                                        onClick={handleDetectLocation}
                                        disabled={isDetecting}
                                        className={cn(
                                            "flex items-center justify-between w-full h-20 px-6 rounded-full bg-neutral-950 border border-white/10 hover:border-primary/50 transition-all group shadow-2xl overflow-hidden",
                                            isDetecting && "opacity-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <MapPin className="h-5 w-5 text-primary" />
                                            <div className="text-left">
                                                <p className={cn(
                                                    "font-cyber text-lg font-black uppercase tracking-tighter text-neutral-200 leading-tight",
                                                    isDetecting && "animate-pulse"
                                                )}>
                                                    {isDetecting ? 'DETECTING...' : (profileForm.watch('location') || 'UNSET LOCATION')}
                                                </p>
                                            </div>
                                        </div>
                                        <RefreshCw className={cn("h-6 w-6 text-neutral-400 group-hover:text-primary transition-colors", isDetecting && "animate-spin")} />
                                    </button>
                                </div>
                            </div>
                             <FormField control={profileForm.control} name="bio" render={({ field }) => (
                                <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea {...field} placeholder="Tell us a little about yourself or your brand." /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Button type="submit" disabled={isProfileSaving || isUploading}>{isProfileSaving && <Loader2 className="animate-spin mr-2" />}Save Changes</Button>
                        </CardContent>
                    </form>
                </Form>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="text-primary" /> Appearance</CardTitle>
                <CardDescription>Customize how the platform looks for you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                    <Label>Theme Preference</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button 
                            onClick={() => setTheme('light')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                                theme === 'light' ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" : "border-white/5 hover:bg-muted/50"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-full transition-colors",
                                theme === 'light' ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}>
                                <Sun className="h-6 w-6" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-[10px]">Light Mode</span>
                        </button>
                        
                        <button 
                            onClick={() => setTheme('dark')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                                theme === 'dark' ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" : "border-white/5 hover:bg-muted/50"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-full transition-colors",
                                theme === 'dark' ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}>
                                <Moon className="h-6 w-6" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-[10px]">Dark Mode</span>
                        </button>

                        <button 
                            onClick={() => setTheme('system')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                                theme === 'system' ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" : "border-white/5 hover:bg-muted/50"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-full transition-colors",
                                theme === 'system' ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}>
                                <Monitor className="h-6 w-6" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-[10px]">System Default</span>
                        </button>
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification">
            <Card>
                <CardHeader><CardTitle>Seller Verification</CardTitle><CardDescription>Submit your documents to become a verified seller.</CardDescription></CardHeader>
                <CardContent><SellerVerificationForm user={user} userProfile={userProfile} isLoading={isProfileLoading}/></CardContent>
            </Card>
          </TabsContent>

          {userProfile?.userRole === 'seller' && (
            <TabsContent value="shop">
              <AccountShopProfile />
            </TabsContent>
          )}

          <TabsContent value="security">
            <SecurityAndSessions />
          </TabsContent>

          <TabsContent value="support">
            <AccountSupport />
          </TabsContent>
        </Tabs>
      </div>
    );
};

export default function AccountSettingsPageWrapper() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const isLoading = isUserLoading || isProfileLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    const renderContent = () => {
        const content = <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />;
        
        switch (userProfile?.userRole) {
            case 'seller':
                return <SellerLayout>{content}</SellerLayout>;
            default:
                return <BuyerLayout>{content}</BuyerLayout>;
        }
    };

    return renderContent();
}
