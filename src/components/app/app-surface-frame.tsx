'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';

import { useAuth, useSurface } from '@/firebase';
import { AdminAppTabBar } from '@/components/admin/admin-app-tab-bar';
import { openAdminSurface } from '@/lib/auth/surface';
import { roleHomeFor, resolveRole } from '@/lib/auth/roles';
import { useSignOutToHome } from '@/lib/auth/sign-out-to-home';
import { useUser, useUserProfile } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

/**
 * APP SURFACE FRAME.
 *
 * Shared app chrome — a mobile top bar, with no bottom tab bar — applied to the
 * routes that do not belong to a role section (the entry screen, shared website
 * pages opened from inside the app).
 *
 * The bottom tab bar that used to sit under every shared app route is gone on
 * purpose: it is why a seller could see *two* navigations. The shared,
 * role-agnostic bar (Home · Products · Create · Orders · Requests · Account)
 * appeared on shared app screens while the seller's own section bar and drawer
 * were right there in the same session. A role has exactly one navigation, its
 * own section's, so the shared bar was removed rather than duplicated. A shared
 * screen reached from the app keeps the top bar: back, title, and the way out.
 *
 * Role sections are exempt: `/app/seller/*` and `/app/buyer/*` are each wrapped
 * by their own layout and shell, so neither role ever sees this chrome and the
 * two sections never share a layout. Renders nothing at all on the website
 * surface.
 */

/** Website routes that read as their own section (drive the back button). */
const ROOT_PATHS = ['/dashboard/seller', '/dashboard/reseller', '/'];

/**
 * Routes that carry their own branding and get no shared chrome.
 *
 * The account screens are the important case. `/login` opened from inside the
 * app used to wear this bar: a back chevron beside the word "Vidnov", because
 * `sectionTitle()` has no entry for `/login` and falls through to its default.
 *
 * That was worse than decoration. `home` resolves to the viewer's own section
 * — `/app/seller` or `/app/buyer` — so the back button on a SIGNED-OUT screen
 * pointed at a route that needs a session. Someone following it left a page
 * they could act on for one they could not. And they had not come from that
 * section anyway: they came from the app home.
 *
 * Every one of these pages already leads with its own product mark, so the bar
 * was a second brand header as well. Signing in is a task, not a destination,
 * and a task does not need a back button pointed at the wrong place.
 */
const STANDALONE_PATHS = [
  '/app',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export function AppSurfaceFrame({ children }: { children: React.ReactNode }) {
  const surface = useSurface();
  const pathname = usePathname() ?? '/';
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);

  // Tag the document so CSS can scope app-surface rules without every page
  // having to know about the app. Runs before any early return — hooks must
  // not be conditional.
  React.useEffect(() => {
    if (surface !== 'app' && surface !== 'admin') return;
    document.documentElement.dataset.vidnovSurface = surface;
    return () => {
      delete document.documentElement.dataset.vidnovSurface;
    };
  }, [surface]);

  // Before the surface is known (first render, and every SSR pass) render the
  // plain children — exactly what the server produced. Guessing here is what
  // caused the hydration mismatch, so this branch is deliberately inert.
  if (surface === null) return <>{children}</>;

  // The admin console is its own application: minimal chrome, its own
  // navigation, and never the consumer tab bar.
  if (surface === 'admin') {
    return (
      <>
        {children}
        <AdminAppTabBar />
      </>
    );
  }

  if (surface !== 'app') return <>{children}</>;

  // ── Screens that own their chrome ─────────────────────────────────────
  // `/app` is the app homepage and already carries its own masthead. Wrapping
  // it in this bar drew a second brand header over it, and — worse — the back
  // button on that bar pointed at `/app/seller`, a route that needs a session.
  // On the signed-out homepage it offered an exit into a screen the visitor
  // cannot see. The homepage has nowhere to go back *to* anyway: it is the
  // entry.
  //
  // `/app/seller/*` renders inside its own layout (SellerAppShell) with its own
  // top bar, its own tab bar and its own design scope. Wrapping it here as well
  // would stack two navs on one screen — and would put the shared, role-agnostic
  // chrome around a section that is deliberately section-specific. The buyer
  // section is treated the same way under `/app/buyer/*`, so the two sections
  // never share a layout. Admin has no app section at all.
  if (
    STANDALONE_PATHS.includes(pathname) ||
    pathname === '/app/seller' ||
    pathname.startsWith('/app/seller/') ||
    pathname === '/app/buyer' ||
    pathname.startsWith('/app/buyer/')
  ) {
    return <>{children}</>;
  }

  // Back always leads to *this user's own* workspace, on THIS surface. Deriving
  // it from the path instead would send a seller browsing a shared route back to
  // the wrong workspace, because several routes are reachable from more than one
  // section. Resolving it per-surface matters for the same reason sign-in does:
  // `ROLE_HOME` alone is the WEBSITE home, so back would have walked out of the
  // app and into the site.
  const role = resolveRole(userProfile);
  const home = roleHomeFor(role ?? 'seller', surface);
  const isRoot = pathname === home || ROOT_PATHS.includes(pathname);

  return (
    <>
      {/* Top bar: back out of a section, or the brand on a root screen. */}
      <div className="vn-app-topbar sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
          {isRoot ? (
            <Logo className="px-1 text-2xl" />
          ) : (
            <>
              <Link
                href={home}
                aria-label="Back to my workspace"
                className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {sectionTitle(pathname)}
              </span>
            </>
          )}
          <LeaveAppButton />
        </div>
      </div>

      {children}
    </>
  );
}

/**
 * The one way out of a shared app screen.
 *
 * This used to carry TWO buttons: a globe that handed the user to the website,
 * and a sign-out. The globe is gone.
 *
 * A "use the website instead" affordance inside the app says, out loud, that
 * the app cannot do what the website does. It is a full navigation to a
 * different session, so on an app screen reached mid-session it silently threw
 * away the app context the user was standing in — and it appeared on the
 * signed-out screens too, where it offered a stranger the one route out of a
 * product they had not yet used.
 *
 * Sign out stays. It is the only honest exit from the app.
 */
function LeaveAppButton() {
  const auth = useAuth();
  const signOutAndGoHome = useSignOutToHome(auth);
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);

  if (!user) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Sign out of the app"
        title="Sign out of the app"
        onClick={signOutAndGoHome}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Human label for the current page in the app top bar.
 *
 * Matched on the path rather than derived from the role, so a seller deep in
 * their own section sees what that section is called.
 */
function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/dashboard/seller')) return 'Seller workspace';
  if (pathname.startsWith('/dashboard/reseller')) return 'Reseller workspace';
  if (pathname.startsWith('/dashboard/products') || pathname.startsWith('/seller/studio')) return 'Products';
  if (pathname.startsWith('/dashboard/seller/orders')) return 'Orders';
  if (pathname.startsWith('/buyer')) return 'Shopping';
  if (pathname.startsWith('/requests')) return 'Requests';
  if (pathname.startsWith('/cart')) return 'Cart';
  if (pathname.startsWith('/search') || pathname.startsWith('/products')) return 'Shop';
  if (pathname.startsWith('/dashboard/account') || pathname.startsWith('/dashboard/security')) {
    return 'Account';
  }
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/live')) return 'Live';
  return 'Vidnov';
}