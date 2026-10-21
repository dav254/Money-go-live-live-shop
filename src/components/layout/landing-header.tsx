'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Search, Bell, MessageSquare, User, LogOut, Settings, LayoutDashboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo } from '../logo';
import { ThemeToggle } from '../theme-toggle';
import { useUser, useUserProfile, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { ROLE_HOME, resolveRole } from '@/lib/auth/roles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * LANDING HEADER — the website chrome.
 *
 * Navigation points only at routes that exist and are reachable for the role
 * that is likely to click them. The search box is the universal entry: it
 * submits to `/search?q=…`, the platform's own results page.
 *
 * Signed-in users get their notifications, messages and an account menu whose
 * "Dashboard" link resolves through `ROLE_HOME`, so a buyer, a seller and an
 * admin each land in their own workspace rather than each other's.
 */

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Discover', href: '/buyer/discovery' },
  { label: 'Marketplace', href: '/categories' },
  { label: 'AI Studio', href: '/ai-studio' },
  { label: 'Shops', href: '/search?q=shop' },
  { label: 'Services', href: '/requests' },
] as const;

function UniversalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [term, setTerm] = React.useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={submit} role="search" className={className}>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 backdrop-blur vn-transition focus-within:border-primary/50">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search products, shops, services…"
          aria-label="Search Vidnov"
          className="w-full min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </form>
  );
}

function AccountArea() {
  const { user, isLoading } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const auth = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild className="rounded-lg text-[13px] font-medium">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild className="rounded-lg px-5 text-[12px] font-semibold uppercase tracking-[0.12em]">
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
    );
  }

  const role = resolveRole(userProfile);
  const home = role ? ROLE_HOME[role] : '/';

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch {
      // A failed sign-out leaves the session in place; the account menu is
      // still there to try again from.
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" asChild className="h-9 w-9" aria-label="Notifications">
        <Link href="/dashboard/notifications">
          <Bell className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" asChild className="h-9 w-9" aria-label="Messages">
        <Link href="/messages">
          <MessageSquare className="h-4 w-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 rounded-full outline-none ring-ring focus-visible:ring-2"
            aria-label="Account menu"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.photoURL || '/placeholder-avatar.svg'} alt="" />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.displayName || 'Your account'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={home}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/account">
              <Settings className="mr-2 h-4 w-4" /> Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4 md:h-20">
          <Link href="/" className="shrink-0" aria-label="Vidnov home">
            <Logo className="text-2xl md:text-3xl" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[13px] font-medium text-muted-foreground vn-transition hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <UniversalSearch className="hidden md:block md:w-56 lg:w-64" />

          <div className="hidden items-center md:flex">
            <AccountArea />
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <UniversalSearch className="w-32" />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </Button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur-lg md:hidden">
          <nav aria-label="Mobile" className="container mx-auto flex flex-col gap-1 px-4 py-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="border-b border-border py-3 text-[15px] font-medium last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              <AccountArea />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
