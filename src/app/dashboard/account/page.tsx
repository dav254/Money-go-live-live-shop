'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/main-layout';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ResellerLayout } from '@/components/layout/reseller-layout';
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
import { Camera, Lock, User, Loader2, ShieldCheck, UploadCloud, File as FileIcon, X } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

const passwordFormSchema = z.object({
  oldPassword: z.string().min(1, { message: "Old password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const profileFormSchema = z.object({
    fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).optional(),
    username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
    phoneNumber: z.string().optional(),
    bio: z.string().max(180, "Bio cannot be longer than 180 characters").optional(),
    location: z.string().optional(),
    website: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    facebookUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    instagramUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    tiktokUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

const SellerVerificationForm = ({ user, userProfile, isLoading: isProfileLoading }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files)]);
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
    
    if (isProfileLoading) return <p>Loading...</p>;

    if (userProfile?.verificationStatus === 'verified') {
        return (
            <Alert className="bg-green-600/10 border-green-600/50 text-green-300">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <AlertTitle>Verified Seller</AlertTitle>
                <AlertDescription>Your account is verified.</AlertDescription>
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
                    {isUploading ? 'Uploading...' : 'Upload Docs'}
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
            <Button onClick={handleSubmitForVerification} disabled={isUploading || files.length === 0}>Submit Verification</Button>
        </div>
    );
};

const AccountSettingsContent = ({ user, userProfile, isLoading: isProfileLoading }) => {
    const { toast } = useToast();
    const auth = getAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [isProfileSaving, setIsProfileSaving] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            fullName: userProfile?.fullName || '',
            username: userProfile?.username || '',
            phoneNumber: userProfile?.phoneNumber || '',
            bio: userProfile?.bio || '',
            location: userProfile?.location || '',
            website: userProfile?.website || '',
            facebookUrl: userProfile?.socialLinks?.facebook || '',
            instagramUrl: userProfile?.socialLinks?.instagram || '',
            tiktokUrl: userProfile?.socialLinks?.tiktok || '',
        }
    });

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    useEffect(() => {
        if (userProfile) {
            profileForm.reset({
                fullName: userProfile.fullName || '',
                username: userProfile.username || '',
                phoneNumber: userProfile.phoneNumber || '',
                bio: userProfile.bio || '',
                location: userProfile.location || '',
                website: userProfile.website || '',
                facebookUrl: userProfile.socialLinks?.facebook || '',
                instagramUrl: userProfile.socialLinks?.instagram || '',
                tiktokUrl: userProfile.socialLinks?.tiktok || '',
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

    const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
        if (!user) return;
        setIsProfileSaving(true);
        try {
            const { facebookUrl, instagramUrl, tiktokUrl, ...rest } = values;
            const profileData = {
                ...rest,
                profilePictureUrl: avatarUrl,
                socialLinks: {
                    facebook: facebookUrl,
                    instagram: instagramUrl,
                    tiktok: tiktokUrl,
                }
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

    const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
        if (!user || !user.email) return;
        setIsPasswordSaving(true);
        const credential = EmailAuthProvider.credential(user.email, values.oldPassword);
        try {
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, values.newPassword);
            toast({ title: 'Password Updated' });
            passwordForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Your old password might be incorrect.' });
        } finally {
            setIsPasswordSaving(false);
        }
    };

    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Account & Settings</h1>
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" /> My Profile</TabsTrigger>
            {userProfile?.userRole === 'seller' && <TabsTrigger value="verification"><ShieldCheck className="mr-2 h-4 w-4" /> Verification</TabsTrigger>}
            <TabsTrigger value="security"><Lock className="mr-2 h-4 w-4" /> Security</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardHeader>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>Update your personal and social information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={avatarUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} />
                                    <AvatarFallback>{userProfile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                    <input type="file" ref={avatarInputRef} onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} accept="image/*" className="hidden" />
                                    <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                        Change Picture
                                    </Button>
                                    {isUploading && <Progress value={uploadProgress} className="h-1" />}
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
                                <FormField control={profileForm.control} name="location" render={({ field }) => (
                                    <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="Nairobi, Kenya" /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <FormField control={profileForm.control} name="bio" render={({ field }) => (
                                <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea {...field} placeholder="Tell us a little about yourself or your brand." /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Separator />
                            <h3 className="text-lg font-medium">Online Presence</h3>
                             <div className="space-y-4">
                                <FormField control={profileForm.control} name="website" render={({ field }) => (
                                    <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://your-shop.com" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="facebookUrl" render={({ field }) => (
                                    <FormItem><FormLabel>Facebook</FormLabel><FormControl><Input {...field} placeholder="https://facebook.com/your-profile" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="instagramUrl" render={({ field }) => (
                                    <FormItem><FormLabel>Instagram</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/your-profile" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="tiktokUrl" render={({ field }) => (
                                    <FormItem><FormLabel>TikTok</FormLabel><FormControl><Input {...field} placeholder="https://tiktok.com/@your-profile" /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <Button type="submit" disabled={isProfileSaving}>{isProfileSaving && <Loader2 className="animate-spin mr-2" />}Save Changes</Button>
                        </CardContent>
                    </form>
                </Form>
            </Card>
          </TabsContent>

          <TabsContent value="verification">
            <Card>
                <CardHeader><CardTitle>Seller Verification</CardTitle><CardDescription>Submit your documents to become a verified seller.</CardDescription></CardHeader>
                <CardContent><SellerVerificationForm user={user} userProfile={userProfile} isLoading={isProfileLoading}/></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader><CardTitle>Security Settings</CardTitle><CardDescription>Manage your password and account security.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                 <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                        <FormField control={passwordForm.control} name="oldPassword" render={({ field }) => (
                            <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                                <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                                <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <Button type="submit" disabled={isPasswordSaving}>{isPasswordSaving && <Loader2 className="animate-spin mr-2" />}Update Password</Button>
                    </form>
                 </Form>
              </CardContent>
            </Card>
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

    // Default to BuyerLayout if userRole is not set
    const Layout = userProfile?.userRole === 'seller' ? SellerLayout : 
                   userProfile?.userRole === 'reseller' ? ResellerLayout : BuyerLayout;

    return (
        <Layout>
            <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />
        </Layout>
    );
}
