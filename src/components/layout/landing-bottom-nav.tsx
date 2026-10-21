'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusSquare, Store, User } from 'lucide-react';

import { useUser, useUserProfile } from '@/firebase';
import { ROLE_HOME, resolveRole } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

/**
 * MOBILE BOTTOM NAV — the marketing surface's persistent navigation.
 *
 * Five destinations, no more: Home, Discover, Create, Marketplace, Profile.
 * "Create" goes to AI Studio (every signed-in role can open it; guests are
 * asked to sign in there). "Profile" resolves through ROLE_HOME when signed
 * in and falls back to /login for visitors, so the same bar works for both.
 *
 * Safe-area aware: `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of
 * the iPhone home indicator, and LandingLayout pads the page bottom by the
 * same amount so the last content is never hidden behind the bar.
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** True when this item should highlight for a whole route family. */
  match?: (pathname: string) => boolean;
}

function itemsFor(hasUser: boolean, roleHome: string): NavItem[] {
  return [
    { label: 'Home', href: '/', icon: Home, match: (p) => p === '/' },
    { label: 'Discover', href: '/buyer/discovery', icon: Compass, match: (p) => p.startsWith('/buyer/discovery') || p.startsWith('/search') },
    { label: 'Create', href: '/ai-studio', icon: PlusSquare, match: (p) => p.startsWith('/ai-studio') },
    { label: 'Marketplace', href: '/categories', icon: Store, match: (p) => p.startsWith('/categories') || p.startsWith('/products') },
    {
      label: 'Profile',
      href: hasUser ? roleHome : '/login',
      icon: User,
      match: (p) => p.startsWith('/dashboard') || p.startsWith('/buyer/dashboard') || p.startsWith('/app'),
    },
  ];
}

export function LandingBottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);

  const role = resolveRole(userProfile);
  const roleHome = role ? ROLE_HOME[role] : '/buyer/dashboard';
  const items = React.useMemo(
    () => itemsFor(!!user, roleHome),
    [user, roleHome],
  );

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map((item) => {
          const active = item.match?.(pathname) ?? false;
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium vn-transition',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
