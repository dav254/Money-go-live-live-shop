'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell, ChevronRight, Heart, HelpCircle, LogOut, Mail,
  Sparkles, Store, Wallet,
} from 'lucide-react';

import { collection, limit, query, where } from 'firebase/firestore';
import {
  useAuth, useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile,
} from '@/firebase';
import type { Order } from '@/lib/types';
import { useSignOutToHome } from '@/lib/auth/sign-out-to-home';
import { BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · ACCOUNT.
 *
 * The website spreads this across `/buyer/dashboard`'s quick links, `/buyer/wallet`,
 * `/buyer/wishlist` and `/buyer/help`. The app collects the essentials into one
 * screen inside the buyer section, with the two exits a separate-surface app
 * needs: open the website, or sign out of this session only.
 */
export default function BuyerSectionAccount() {
  const auth = useAuth();
  const signOutAndGoHome = useSignOutToHome(auth);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.uid),
      limit(100),
    );
  }, [firestore, user]);

  const { data: orders } = useCollection<Order>(ordersQuery);
  const profile = (userProfile ?? null) as {
    fullName?: string;
    aiPoints?: number;
  } | null;

  const initials = (profile?.fullName ?? 'You')
    .split(' ')
    .map((p: string) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const delivered = orders?.filter((o) => o.orderStatus === 'delivered').length ?? 0;
  const isLoading = isProfileLoading;

  const shortcuts = [
    // Every href here is a route inside `/app/buyer/*`. These five used to
    // point at the website (`/buyer/wallet`, `/buyer/wishlist`,
    // `/buyer/notifications`, `/messages`, `/buyer/help`), so one tap from the
    // account screen dropped the buyer out of the installed app and into the
    // website's desktop layout.
    { label: 'Refunds & payments', hint: 'Credit and refund history', icon: Wallet, href: '/app/buyer/wallet' },
    { label: 'My requests', hint: 'Briefs you posted', icon: Sparkles, href: '/app/buyer/requests' },
    { label: 'Saved items', hint: 'Your wishlist', icon: Heart, href: '/app/buyer/shop?view=saved' },
    { label: 'Notifications', hint: 'Orders and offers', icon: Bell, href: '/app/buyer/notifications' },
    { label: 'Help centre', hint: 'Answers and support', icon: HelpCircle, href: '/app/buyer/care' },
    { label: 'My sellers', hint: 'Shops you follow', icon: Store, href: '/app/buyer/sellers' },
  ];

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <BuyerSectionTitle eyebrow="Section" title="Account" />

      {/* Identity band */}
      <section className="px-4">
        <div className="vn-buyer-band flex items-center gap-4 rounded-3xl p-4 shadow-lg">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-sans text-lg font-bold ring-1 ring-white/25">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">
              {profile?.fullName || 'Buyer'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate font-sans text-xs text-white/70">
              <Mail className="h-3 w-3 shrink-0" />
              {user?.email}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest ring-1 ring-white/25">
            Buyer
          </span>
        </div>
      </section>

      {/* Numbers */}
      <section className="grid grid-cols-3 gap-2.5 px-4">
        {[
          { label: 'Orders', value: isLoading ? '—' : String(orders?.length ?? 0) },
          { label: 'Delivered', value: isLoading ? '—' : String(delivered) },
          { label: 'AI points', value: (profile?.aiPoints ?? 0).toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="vn-buyer-card px-3 py-3 text-center">
            <p className="text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
            <p className="vn-micro mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* Shortcuts */}
      <section>
        <BuyerSectionTitle eyebrow="Go to" title="Shortcuts" />
        <div className="space-y-2 px-4">
          {shortcuts.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="vn-buyer-card flex items-center gap-3 p-3.5 transition hover:scale-[1.01]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/25 text-cyan-600 dark:text-cyan-300">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                <span className="block truncate font-sans text-[11px] text-muted-foreground">
                  {item.hint}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* Exits.
          "Use the website" used to sit here above sign out. It is gone for the
          same reason it is gone on the seller account screen: an app that
          offers to leave itself is telling the user it cannot do what the
          website does. The app is the app. Signing out stays — that one is about
          the device, not about which application is open. */}
      <section className="space-y-2 px-4">
        <button
          type="button"
          onClick={signOutAndGoHome}
          className="vn-buyer-card flex w-full items-center gap-3 p-3.5 text-left ring-1 ring-red-500/25 transition hover:bg-red-500/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-red-500">Sign out of the app</span>
            <span className="block font-sans text-[11px] text-muted-foreground">
              Only this device&apos;s app session
            </span>
          </span>
        </button>
      </section>

      <p className="vn-micro px-4 pb-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Vidnov buyer app · section 2 of 3
      </p>
    </div>
  );
}
