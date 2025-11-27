
'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Landmark, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

// In a real app, these values would be fetched from a secure backend/config store.
// For this UI demo, we'll use local state.

const GatewayCard = ({
  name,
  icon: Icon,
  children,
}: {
  name: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => {
  const [isEnabled, setIsEnabled] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="text-primary" />
            {name}
          </CardTitle>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            aria-label={`Enable ${name}`}
          />
        </div>
        <CardDescription>
          Manage API keys and settings for {name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
};

export default function AdminGatewaysPage() {
  const { toast } = useToast();

  const handleSaveChanges = () => {
    // This is where you would securely save the settings to your backend.
    toast({
      title: 'Settings Saved!',
      description: 'Your payment gateway settings have been updated.',
    });
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Payment Gateways
          </h1>
          <Button onClick={handleSaveChanges}>Save All Settings</Button>
        </div>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {/* Paystack Gateway */}
          <GatewayCard name="Paystack" icon={Landmark}>
            <div className="space-y-2">
              <Label htmlFor="paystack-pk">Public Key</Label>
              <Input
                id="paystack-pk"
                type="password"
                placeholder="pk_test_************************"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paystack-sk">Secret Key</Label>
              <Input
                id="paystack-sk"
                type="password"
                placeholder="sk_test_************************"
              />
            </div>
            <Separator />
             <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="paystack-mode" className="flex flex-col space-y-1">
                  <span>Live Mode</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Enable to process real payments.
                  </span>
                </Label>
                <Switch
                  id="paystack-mode"
                  aria-label="Paystack Live Mode"
                />
              </div>
          </GatewayCard>

          {/* PayPal Gateway */}
          <GatewayCard name="PayPal" icon={Landmark}>
            <div className="space-y-2">
              <Label htmlFor="paypal-id">Client ID</Label>
              <Input
                id="paypal-id"
                type="password"
                placeholder="AZ***************************************************"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paypal-secret">Client Secret</Label>
              <Input
                id="paypal-secret"
                type="password"
                placeholder="EG***************************************************"
              />
            </div>
            <Separator />
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="paypal-mode" className="flex flex-col space-y-1">
                  <span>Live Mode</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Use 'Live' for production, 'Sandbox' for testing.
                  </span>
                </Label>
                <Switch
                  id="paypal-mode"
                  aria-label="PayPal Live Mode"
                />
              </div>
          </GatewayCard>
        </div>
      </div>
    </AdminLayout>
  );
}
