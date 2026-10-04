'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { VidnovLogo } from '@/components/logo';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams?.get('oobCode') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This reset link is missing its security code. Request a fresh link.');
    }
  }, [token]);

  const passwordChecks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'A number or symbol', ok: /[0-9!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDone(true);
        // The user asked to land on the homepage once the password is confirmed.
        setTimeout(() => router.push('/'), 2500);
      } else {
        setError(data.message || 'This reset link is invalid or has expired.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 vn-page-enter">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Vidnov home">
            <VidnovLogo className="h-12 w-12" color="var(--foreground)" />
          </Link>
        </div>

        <Card className="rounded-2xl border-border vn-shadow">
          <CardHeader className="text-center">
            {done ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="font-grotesk text-2xl">Password updated</CardTitle>
                <CardDescription className="text-sm">
                  Your password has been changed and other sessions were signed out. Taking you to the homepage…
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="font-grotesk text-2xl">Choose a new password</CardTitle>
                <CardDescription className="text-sm">
                  Pick something strong — this link works once.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {done ? (
              <Button asChild className="w-full h-12 rounded-xl font-semibold">
                <Link href="/">Go to homepage</Link>
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      className="h-12 rounded-xl pl-10 pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {passwordChecks.map(c => (
                      <span
                        key={c.label}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          c.ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {c.ok ? '✓' : '•'} {c.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="h-12 rounded-xl"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-[13px] text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting || !token} className="w-full h-12 rounded-xl font-semibold vn-shadow-glow">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset password
                </Button>

                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground vn-transition">
                    Request a new link
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
