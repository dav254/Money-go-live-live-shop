
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/main-layout';
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
import { Camera, Languages, Lock, Bell, Palette, User, Settings, Loader2, ShieldCheck } from 'lucide-react';
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
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { File as FileIcon, X, UploadCloud } from 'lucide-react';

const passwordFormSchema = z.object({
  oldPassword: z.string().min(1, { message: "Old password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


function SidebarNav({ role }: { role: string | undefined }) {
  if (role === 'admin') {
    return <AdminSidebar />;
  }
  if (role === 'seller') {
    return <SellerSidebar />;
  }
  if (role === 'reseller') {
    return <ResellerSidebar />;
  }
  return <BuyerSidebar />;
}

const SellerVerificationForm = () => {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
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
            // In a real app, you might upload file URLs to a subcollection.
            // For this demo, we'll just update the status.
            await Promise.all(files.map(file => uploadToCloudinary(file)));
            
            const userRef = doc(firestore, 'userProfiles', user.uid);
            const updateData = { verificationStatus: 'pending' };
            
            await updateDoc(userRef, updateData).catch(error => {
                 const permissionError = new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError;
            });
            
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
                <AlertTitle className="!text-yellow-400">Verification Pending</AlertTitle>
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


export default function AccountSettingsPage() {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const { toast } = useToast();
    const auth = getAuth();
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);

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


  return (
    <MainLayout sidebar={isProfileLoading ? <p>Loading...</p> : <SidebarNav role={userProfile?.userRole} />}>
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
            <TabsTrigger value="preferences">
              <Settings className="mr-2 h-4 w-4" /> Preferences
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>
                  Manage your personal information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={userProfile?.profilePictureUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} />
                        <AvatarFallback>{userProfile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Button variant="outline"><Camera className="mr-2 h-4 w-4" /> Change Picture</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" defaultValue={userProfile?.username} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="display-name">Display Name</Label>
                        <Input id="display-name" defaultValue={userProfile?.fullName} />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" defaultValue={userProfile?.email} readOnly />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" defaultValue={userProfile?.phoneNumber} />
                    </div>
                </div>
                <Button>Save Changes</Button>
              </CardContent>
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
                        <SellerVerificationForm />
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
                        <Button>Enable</Button>
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Customize your Go Earn experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Notifications</Label>
                      <p className="text-sm text-muted-foreground">Manage your notification preferences.</p>
                    </div>
                  </div>
                  <Button variant="outline">Manage</Button>
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Palette className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Dark / Light Theme</Label>
                      <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Languages className="h-5 w-5 text-muted-foreground" />
                     <div>
                      <Label>Language</Label>
                       <p className="text-sm text-muted-foreground">Select your preferred language.</p>
                    </div>
                  </div>
                   <Select defaultValue="en">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="sw">Swahili</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </MainLayout>
  );
}
