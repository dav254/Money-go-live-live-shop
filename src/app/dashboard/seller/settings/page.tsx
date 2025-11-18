
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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SellerSettingsPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Shop Settings
        </h1>
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
                  <Input id="shop-name" placeholder="e.g., Aisha's Handbags" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop-description">Shop Description</Label>
                  <Textarea id="shop-description" placeholder="Tell customers about your shop..." />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Shop Logo (1:1 ratio)</Label>
                        <Button variant="outline" className="w-full">Upload Logo</Button>
                    </div>
                     <div className="space-y-2">
                        <Label>Shop Banner (3:1 ratio)</Label>
                        <Button variant="outline" className="w-full">Upload Banner</Button>
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
                    <Switch id="dark-mode" defaultChecked />
                </div>
                 <div>
                  <Label>Accent Color</Label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" className="border-red-500 text-red-500">Red</Button>
                    <Button variant="outline">Blue</Button>
                    <Button variant="outline">Purple</Button>
                    <Button variant="outline">Gold</Button>
                    <Button variant="outline">Pink</Button>
                  </div>
                </div>
                 <div>
                  <Label>Button Style</Label>
                    <RadioGroup defaultValue="rounded" className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rounded" id="r1" />
                            <Label htmlFor="r1">Rounded</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="square" id="r2" />
                            <Label htmlFor="r2">Square</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="soft" id="r3" />
                            <Label htmlFor="r3">Soft</Label>
                        </div>
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
                    <Textarea id="return-policy" rows={6} placeholder="e.g., We accept returns within 7 days of purchase..." />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="shipping-policy">Delivery & Shipping Policy</Label>
                    <Textarea id="shipping-policy" rows={4} placeholder="e.g., We ship nationwide within 2-3 business days..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
