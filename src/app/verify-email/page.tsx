'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle, MailCheck } from 'lucide-react';
import { VidnovLogo } from '@/components/logo';

/**
 * Email verification landing page — the destination of the single-use link
 * sent at sign-up. Auto-consumes `oobCode` exactly once (guarded against
 * React StrictMode double-effects) and shows one of three honest states:
 * verifying · verified · failed. No auth required; nothing here changes the
 * existing session or login behaviour.
 */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = (searchParams?.get('oobCode') ?? '').trim();

  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its security code. Create a new link from sign-up.');
      return;
    }
    if (started.current) return; // StrictMode / re-render guard
    started.current = true;

    let cancelled = false;
    setState('verifying');

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oobCode: token }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (cancelled) return;
        if (res.ok && data.ok) {
          setState('done');
        } else {
          setState('error');
          setMessage(data.message || 'This verification link is invalid or has expired.');
        }
      } catch {
        if (!cancelled) {
          setState('error');
          setMessage('Something went wrong while verifying. Please try again in a moment.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

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
            {state === 'done' ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <MailCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="font-grotesk text-2xl">Email verified</CardTitle>
                <CardDescription className="text-sm">
                  Your address is confirmed and your account is fully active. Welcome to Vidnov.
                </CardDescription>
              </>
            ) : state === 'error' ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="font-grotesk text-2xl">Link not valid</CardTitle>
                <CardDescription className="text-sm">{message}</CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <CardTitle className="font-grotesk text-2xl">Verifying your email</CardTitle>
                <CardDescription className="text-sm">
                  One moment — confirming your address with a secure, single-use link.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            {state === 'verifying' && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </p>
            )}

            {state === 'done' && (
              <Button asChild className="w-full h-12 rounded-xl font-semibold vn-shadow-glow">
                <Link href="/login">Continue to sign in</Link>
              </Button>
            )}

            {state === 'error' && (
              <div className="space-y-3">
                <Button asChild variant="outline" className="w-full h-12 rounded-xl font-semibold">
                  <Link href="/signup">Back to sign up</Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Need help? Visit the{' '}
                  <a href="/faq" className="text-foreground underline underline-offset-2">
                    help centre
                  </a>
                  .
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
