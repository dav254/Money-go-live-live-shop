
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { KeyRound, ShieldCheck, Timer } from 'lucide-react';
import React from 'react';

export default function AdminSecurityPage() {
  // In a real application, these values would be fetched from a global settings document in Firestore.
  const [passwordLength, setPasswordLength] = React.useState(8);
  const [enforce2FA, setEnforce2FA] = React.useState(false);
  const [sessionTimeout, setSessionTimeout] = React.useState(30);

  const handleSaveChanges = () => {
    // This is where you would save the settings to your database.
    console.log({
      passwordLength,
      enforce2FA,
      sessionTimeout,
    });
    // For now, we'll just show a placeholder toast.
    // toast({ title: "Settings Saved!", description: "Security settings have been updated." });
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          System Security
        </h1>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Password Policy Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="text-primary" />
                Password Policy
              </CardTitle>
              <CardDescription>
                Define the security requirements for user passwords.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min-length">Minimum Password Length</Label>
                <Input
                  id="min-length"
                  type="number"
                  value={passwordLength}
                  onChange={(e) => setPasswordLength(parseInt(e.target.value))}
                  min="6"
                  max="32"
                />
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="text-primary" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription>
                Enhance account security by requiring a second verification step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="enforce-2fa" className="flex flex-col space-y-1">
                  <span>Enforce 2FA for All Users</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Users will be required to set up 2FA on their next login.
                  </span>
                </Label>
                <Switch
                  id="enforce-2fa"
                  checked={enforce2FA}
                  onCheckedChange={setEnforce2FA}
                  aria-label="Enforce 2FA"
                />
              </div>
            </CardContent>
          </Card>

          {/* Session Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="text-primary" />
                Session Management
              </CardTitle>
              <CardDescription>
                Control how long user sessions remain active.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">
                  Session Timeout (minutes)
                </Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) =>
                    setSessionTimeout(parseInt(e.target.value))
                  }
                  min="5"
                  max="1440" // 24 hours
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveChanges}>Save Security Settings</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
