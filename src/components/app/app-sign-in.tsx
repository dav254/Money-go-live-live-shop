'use client';

import Link from 'next/link';
import { LogIn, Store } from 'lucide-react';
import { Logo } from '@/components/logo';

/**
 * Signed-out screen for the app.
 *
 * The app shares the website's accounts, so this offers the normal sign-in —
 * same email, same password, same reset — rather than a separate app account.
 * It also states the session rule plainly, because being signed in on the
 * website does not sign you in on the app and users otherwise read that as a
 * bug.
 *
 * One screen serves every section: the seller shell and the buyer shell both
 * render this component when there is no session, because the app has a single
 * account system and only the *section* differs. The section you land in after
 * signing in is decided by your role, not by which screen you signed in from.
 *
 * There is deliberately no "use the website instead" escape hatch here. It
 * offered the one route out of the app to a signed-out user, which is the exact
 * hand-off this section is supposed to stop doing: the app answers for itself,
 * and a signed-out screen offering to become a website is telling the user the
 * app cannot. Signing in and signing up are the whole of the job.
 */
export function AppSignIn() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-background px-6 text-center">
      <Logo className="text-4xl" />

      <div className="space-y-2">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          Sign in to the Vidnov app
        </h1>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          Use the same account you use on the website. One account opens your section —
          sellers get the seller app, buyers get the buyer app.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link
          href="/login?returnTo=/app"
          className="bg-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
        <Link
          href="/signup"
          className="border-border text-foreground inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold"
        >
          <Store className="h-4 w-4" /> Create an account
        </Link>
      </div>
    </div>
  );
}