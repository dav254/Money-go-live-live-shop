'use client';

import React, { useState, useEffect, cloneElement, useRef } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Languages, Lock, Bell, Palette, User, Settings, Loader2, ShieldCheck, LogOut, Store } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { File as FileIcon, X, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const passwordFormSchema = z.object({
  oldPassword: z.string().min(1, { message: "Old password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const profileFormSchema = z.object({
    fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
    username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
    phoneNumber: z.string().optional(),
});


const SellerVerificationForm = ({ user, userProfile, isLoading: isProfileLoading }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
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

    const uploadToCloudinary = async (file: File): Promise<string> => {
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

      return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl, true);
          xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                  const progress = (event.loaded / event.total) * 100;
                  setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              }
          };
          xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                  const uploadedData = JSON.parse(xhr.responseText);
                  resolve(uploadedData.secure_url);
              } else {
                  reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
              }
          };
          xhr.onerror = () => reject(new Error('Network error during upload.'));
          xhr.send(formData);
      });
    };
    
    const handleSubmitForVerification = async () => {
        if (!user || !firestore) return;
        if (files.length === 0) {
            toast({ variant: 'destructive', title: 'No files selected', description: 'Please upload at least one document.' });
            return;
        }

        setIsUploading(true);
        toast({ title: 'Submitting Verification...', description: 'Please wait while we upload your documents.' });
        
        try {
            await Promise.all(files.map(file => uploadToCloudinary(file)));
            
            const userRef = doc(firestore, 'userProfiles', user.uid);
            const updateData = { verificationStatus: 'pending' };
            
            await updateDoc(userRef, updateData);
            
            toast({ title: 'Submitted!', description: 'Your verification request has been sent for review.' });
            setFiles([]);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Submission Failed', description: 'There was an error. Please try again.' });
        } finally {
            setIsUploading(false);
            setUploadProgress({});
        }
    };
    
    if (isProfileLoading) {
      return <p>Loading verification status...</p>
    }

    if (userProfile?.verificationStatus === 'verified') {
        return (
            <Alert variant="default" className="bg-green-600/10 border-green-600/50 text-green-300">
                <ShieldCheck className="h-4 w-4 !text-green-500" />
                <AlertTitle className="!text-green-400">You are a Verified Seller</AlertTitle>
                <AlertDescription>
                   Your account has been successfully verified. You have full access to all seller features.
                </AlertDescription>
            </Alert>
        );
    }
    
     if (userProfile?.verificationStatus === 'pending') {
        return (
            <Alert variant="default" className="bg-yellow-600/10 border-yellow-600/50 text-yellow-300">
                <Loader2 className="h-4 w-4 !text-yellow-500 animate-spin" />
                <AlertTitle className="!text-green-400">Verification Pending</AlertTitle>
                <AlertDescription>
                  Your documents have been submitted and are currently under review. This usually takes 1-2 business days.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <Alert variant="destructive">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Verification Required</AlertTitle>
                <AlertDescription>
                    To ensure a safe marketplace, please upload your verification documents (e.g., National ID, Business Permit).
                </AlertDescription>
            </Alert>

            <div className="space-y-2">
                <Label htmlFor="file-upload">Verification Documents</Label>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    <UploadCloud className="mr-2 h-5 w-5" />
                    {isUploading ? 'Uploading...' : 'Click to select or drag files here'}
                </Button>
            </div>
            
            {files.length > 0 && (
                <div className="space-y-4">
                    <Label>Selected Files</Label>
                    {files.map(file => (
                        <div key={file.name} className="flex items-center gap-3 rounded-md border p-2">
                            <FileIcon className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                {uploadProgress[file.name] !== undefined && (
                                    <Progress value={uploadProgress[file.name]} className="h-1 mt-1" />
                                )}
                            </div>
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => handleFileRemove(file.name)}
                                disabled={isUploading}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            
            <Button onClick={handleSubmitForVerification} disabled={isUploading || files.length === 0}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Verification
            </Button>
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
    const [isUploading, setIsUploading] = useState(false);
    const avatarInputRef = React.useRef<HTMLInputElement>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const isSeller = userProfile?.userRole === 'seller';

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
    });
    
    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            fullName: userProfile?.fullName || '',
            username: userProfile?.username || '',
            phoneNumber: userProfile?.phoneNumber || '',
        }
    });

    useEffect(() => {
        if (userProfile) {
            profileForm.reset({
                fullName: userProfile.fullName || '',
                username: userProfile.username || '',
                phoneNumber: userProfile.phoneNumber || '',
            });
            setAvatarUrl(userProfile.profilePictureUrl || `https://picsum.photos/seed/${user?.uid}/100/100`);
        }
    }, [userProfile, profileForm, user?.uid]);
    
    async function uploadToCloudinary(file: File): Promise<string> {
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

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        toast({ title: 'Uploading new picture...' });
        
        try {
            const uploadedUrl = await uploadToCloudinary(file);
            setAvatarUrl(uploadedUrl);
            toast({ title: 'Picture Updated!', description: 'Click "Save Changes" to apply.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload your picture.' });
        } finally {
            setIsUploading(false);
        }
    };


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

     async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
        if (!user || !firestore) return;
        setIsProfileSaving(true);
        const userRef = doc(firestore, 'userProfiles', user.uid);
        
        const dataToUpdate: any = {
            ...values,
            profilePictureUrl: avatarUrl,
        };

        try {
            await updateDoc(userRef, dataToUpdate);
            toast({ title: 'Profile Updated!', description: 'Your changes have been saved.' });
        } catch (error) {
            console.error("Profile update error:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: dataToUpdate
            }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your profile.' });
        } finally {
            setIsProfileSaving(false);
        }
    }

    const handleSignOut = async () => {
        setIsLoggingOut(true);
        try {
            await signOut(auth);
            toast({
                title: 'Signed Out',
                description: 'You have been successfully signed out.',
            });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error("Sign out error", error);
            toast({
                variant: 'destructive',
                title: 'Error signing out',
                description: 'There was a problem signing you out. Please try again.',
            });
        } finally {
            setIsLoggingOut(false);
        }
    };

  return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Account & Settings
        </h1>
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" /> My Profile
            </TabsTrigger>
             {userProfile?.userRole === 'seller' && (
                <TabsTrigger value="verification">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Verification
                </TabsTrigger>
            )}
            <TabsTrigger value="security">
              <Lock className="mr-2 h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <Card>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardHeader>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>
                            Manage your personal information.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isSeller && (
                                <Alert>
                                    <Store className="h-4 w-4" />
                                    <AlertTitle>You're a Seller!</AlertTitle>
                                    <AlertDescription>
                                        Your username and profile picture are linked to your shop's branding. To change them, please go to your <Link href="/dashboard/seller/settings" className="font-semibold underline">Shop Settings</Link>.
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div className="flex items-center gap-6">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={avatarUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} />
                                    <AvatarFallback>{userProfile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                                <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={isUploading || isSeller}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />}
                                    {isUploading ? 'Uploading...' : 'Change Picture'}
                                </Button>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={profileForm.control} name="username" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl><Input {...field} disabled={isSeller} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={profileForm.control} name="fullName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Display Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={userProfile?.email || ''} readOnly disabled />
                                </div>
                                <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl><Input type="tel" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <Button type="submit" disabled={isProfileSaving || isUploading || isSeller}>
                                {isProfileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Save Changes
                            </Button>
                        </CardContent>
                    </form>
                </Form>
            </Card>
          </TabsContent>

          {userProfile?.userRole === 'seller' && (
            <TabsContent value="verification" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Seller Verification</CardTitle>
                        <CardDescription>Verify your identity to unlock all seller features and build trust with buyers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SellerVerificationForm user={user} userProfile={userProfile} isLoading={isProfileLoading}/>
                    </CardContent>
                </Card>
            </TabsContent>
          )}

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
                <Separator />
                 <div>
                    <h3 className="text-lg font-medium">Two-Factor Authentication (2FA)</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-4">
                        <div>
                            <Label>Enable 2FA</Label>
                            <p className="text-sm text-muted-foreground">Keep your account extra secure with a second verification step.</p>
                        </div>
                        <Button disabled>Enable</Button>
                    </div>
                </div>
                <Separator />
                <div>
                    <h3 className="text-lg font-medium">Log Out</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-4">
                        <div>
                            <Label>End your current session</Label>
                            <p className="text-sm text-muted-foreground">This will log you out from your account on this device.</p>
                        </div>
                        <Button variant="destructive" onClick={handleSignOut} disabled={isLoggingOut}>
                            {isLoggingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Log Out
                        </Button>
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}

export default function AccountSettingsPageWrapper() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const isLoading = isUserLoading || isProfileLoading;

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-screen w-full items-center justify-center">
                    <p>Loading Account...</p>
                </div>
            </MainLayout>
        )
    }

    if (userProfile?.userRole === 'seller') {
        return (
            <SellerLayout>
                <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />
            </SellerLayout>
        );
    }
    
    if (userProfile?.userRole === 'buyer') {
        return (
            <BuyerLayout>
                <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />
            </BuyerLayout>
        );
    }
    
    if (userProfile?.userRole === 'reseller') {
        // Here we pass the loaded data as props
        return (
            <ResellerLayout>
                <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />
            </ResellerLayout>
        );
    }
    
    // Fallback for other roles or if role is not defined
    return (
        <MainLayout>
            <AccountSettingsContent user={user} userProfile={userProfile} isLoading={isLoading} />
        </MainLayout>
    );
}