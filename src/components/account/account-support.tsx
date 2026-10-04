'use client';

/**
 * AccountSupport — support resources inside the Account page: help
 * center, FAQ, complaint/contact channels. Replaces the sidebar entry.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  HelpCircle, MessageSquareText, LifeBuoy, ChevronRight, ShieldCheck, FileQuestion,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const RESOURCES = [
  {
    icon: FileQuestion,
    title: 'Help Center',
    desc: 'Guides for selling, orders, payments and the request marketplace.',
    href: '/faq',
  },
  {
    icon: MessageSquareText,
    title: 'Messages',
    desc: 'Talk directly to buyers, sellers and the Vidnov support team.',
    href: '/messages',
  },
  {
    icon: ShieldCheck,
    title: 'Account & security',
    desc: 'Sessions, password changes and account protection in one place.',
    href: '/dashboard/account?tab=security',
  },
];

export function AccountSupport() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="font-grotesk text-lg flex items-center gap-2">
            <LifeBuoy className="h-4.5 w-4.5 text-primary" /> How can we help?
          </CardTitle>
          <CardDescription>
            Fast answers and direct lines to the Vidnov team.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {RESOURCES.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              className="group flex items-center gap-4 rounded-xl border border-border p-4 vn-transition hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{r.title}</span>
                <span className="block text-[12px] text-muted-foreground">{r.desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary vn-transition" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border bg-muted/30">
        <CardContent className="flex items-start gap-3 p-5">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Business account? Your seller onboarding guide, payout schedule and verification
            status live in the dashboard. For anything urgent, message us from
            {' '}<Link href="/messages" className="font-semibold text-foreground underline underline-offset-2">Messages</Link>{' '}
            — replies land in the same inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
