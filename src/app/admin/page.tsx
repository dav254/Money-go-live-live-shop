'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { ShieldCheck, Loader2, ArrowLeft, LogIn, KeyRound } from 'lucide-react';
import { useAuth } from '@/firebase';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { openWebSurface } from '@/lib/auth/surface';

/**
 * ADMIN CONSOLE — entry.
 *
 * Administration is a separate application, not a tab inside the website:
 *
 *   • it runs under its own surface (`/admin`), which has its own Firebase app
 *     and therefore its own session — a seller or buyer signed in to the site
 *     is simply not signed in here;
 *   • `SurfaceBoundary` signs out anyone whose profile is not an admin;
 *   • the account is the same one used everywhere else, so there is no second
 *     set of credentials to manage or leak.
 *
 * Only the Firebase project, the user store and the rules are shared. That is
 * the point: identity is shared, authority is not.
 */
export default function AdminConsoleEntryPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isBusy, setIsBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    try {
      // The admin console is sign-in only. Admin accounts are provisioned by
      // another admin; there is no public sign-up here, which removes account
      // enumeration from this surface entirely.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/dashboard/admin');
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      const message =
        code === 'auth/invalid-credential'
          ? 'Those credentials were not recognised.'
          : code === 'auth/too-many-requests'
            ? 'Too many attempts. Try again shortly.'
            : code === 'auth/user-not-found'
              ? 'Those credentials were not recognised.'
              : 'Sign-in failed. Try again.';
      toast({ variant: 'destructive', title: 'Sign-in failed', description: message });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      toast({ variant: 'destructive', title: 'Enter your admin email first' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({
        title: 'Reset email sent',
        description: 'If that address belongs to an admin account, a reset link is on its way.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not send the reset email' });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-12 w-12" />
          <div>
            <h1 className="font-grotesk text-xl font-bold tracking-tight text-foreground">
              Vidnov Admin
            </h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Restricted system access
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-base">Sign in</CardTitle>
            <CardDescription>
              Admin accounts only. Use the same account you use for Vidnov.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isBusy}>
                {isBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Sign in to the console
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleReset}
                disabled={isBusy}
              >
                <KeyRound className="mr-2 h-3.5 w-3.5" />
                Forgot password
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => openWebSurface('/')}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back to the Vidnov site
          </Button>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
          The admin console keeps a separate session from the seller and buyer app. Being
          signed in there does not sign you in here.
        </p>
      </div>
    </div>
  );
}