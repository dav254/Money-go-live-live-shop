
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
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
import { Camera, Languages, Lock, Bell, Palette, User, Settings } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import React from 'react';


export default function AdminAccountSettingsPage() {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Account & Settings
        </h1>
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" /> My Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="mr-2 h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings className="mr-2 h-4 w-4" /> Preferences
            </TabsTrigger>
          </TabsList>
          
          {/* My Profile Tab */}
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
                        <AvatarFallback>AD</AvatarFallback>
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
                 <div>
                    <h3 className="text-lg font-medium">Change Password</h3>
                    <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">Old Password</Label>
                            <Input id="old-password" type="password" />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input id="new-password" type="password" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input id="confirm-password" type="password" />
                            </div>
                        </div>
                        <Button>Update Password</Button>
                    </div>
                </div>
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
          
           {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Customize your MoneyGo experience.
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
    </AdminLayout>
  );
}
