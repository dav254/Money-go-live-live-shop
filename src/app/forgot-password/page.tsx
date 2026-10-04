'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailCheck, ArrowLeft, ShieldCheck } from 'lucide-react';
import { VidnovLogo } from '@/components/logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // The API always answers ok:true with a generic message.
      setSubmitted(true);
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
            {submitted ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <MailCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="font-grotesk text-2xl">Check your inbox</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  If an account exists for this email, we have sent instructions to reset your password.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="font-grotesk text-2xl">Forgot your password?</CardTitle>
                <CardDescription className="text-sm">
                  Enter your email and we’ll send you a secure reset link. It expires in 60 minutes.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="space-y-5">
                <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 p-4 text-[13px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  The link works once and can only be used by whoever has access to this inbox.
                </div>
                <Button asChild className="w-full h-12 rounded-xl font-semibold">
                  <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back to login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    className="h-12 rounded-xl"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-semibold vn-shadow-glow">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground vn-transition">
                    <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to login
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
