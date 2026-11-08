import type { Metadata } from 'next';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Delete your Vidnov account',
  description:
    'How to request deletion of your Vidnov account and the data attached to it, from the Android app or by email.',
  alternates: { canonical: 'https://vidnov.com/account-deletion' },
  robots: { index: true, follow: true },
};

/**
 * PUBLIC ACCOUNT DELETION PAGE.
 *
 * Google Play's Data deletion policy requires a URL that works WITHOUT
 * installing the app, explaining how to request deletion and what happens to
 * the data. The in-app path is the normal route; email is the fallback for
 * people who already uninstalled or cannot sign in.
 *
 * The wording is deliberately concrete: what is removed, what is retained for
 * legal/accounting reasons, and how long a request takes.
 */
export default function AccountDeletionPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-3xl py-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-3xl">Delete your Vidnov account</CardTitle>
            <p className="text-muted-foreground">
              You can request deletion at any time. This page works without the Android app.
            </p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <h2>From the Android app</h2>
            <ol>
              <li>Open Vidnov and sign in to the account you want deleted.</li>
              <li>
                Go to <strong>My Account → Settings</strong>.
              </li>
              <li>
                Under <strong>Delete account</strong>, tap <strong>Request deletion</strong> and
                confirm.
              </li>
            </ol>
            <p>
              The request is recorded against your account immediately and support reviews it before
              anything is removed, so an accidental tap cannot destroy an active shop.
            </p>

            <h2>By email</h2>
            <p>
              If you cannot sign in or have already uninstalled the app, email{' '}
              <a href="mailto:support@vidnov.com?subject=Account%20deletion%20request">
                support@vidnov.com
              </a>{' '}
              from the address on the account, with the subject “Account deletion request”. We reply
              within 30 days.
            </p>

            <h2>What is deleted</h2>
            <ul>
              <li>Your account and sign-in credentials.</li>
              <li>Your profile, photo, phone number and bio.</li>
              <li>Your shop, product listings, photos and uploaded media.</li>
              <li>Your messages, saved items, requests and offers.</li>
              <li>Your app and notification tokens.</li>
            </ul>

            <h2>What is kept, and why</h2>
            <p>
              Records of completed orders and payouts are retained where tax, accounting or
              anti-fraud law requires it, and dispute records are kept for the period needed to
              resolve a claim. These records are not used for marketing, and they are deleted once
              the legal retention period ends.
            </p>

            <h2>Before you delete</h2>
            <p>
              Deletion is permanent. Active orders should be completed or cancelled first, and any
              payout balance should be withdrawn. For anything else, email{' '}
              <a href="mailto:support@vidnov.com">support@vidnov.com</a> or read our{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
