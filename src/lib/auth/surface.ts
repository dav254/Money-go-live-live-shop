/**
 * VIDNOV SURFACE BOUNDARY (session isolation).
 *
 * ## The leak this fixes
 *
 * Firebase stores the signed-in user under a persistence key built from the
 * Firebase *app name*:
 *
 *     firebase:authUser:<apiKey>:<appName>          (@firebase/auth)
 *     firebase:authUser:<apiKey>:[DEFAULT]          ← what we used to create
 *
 * We only ever created the default app, so the installed PWA and the browser on
 * the same origin shared one slot. Signing in as admin in the browser therefore
 * *also* signed the phone app in as admin, and a seller session in the app
 * leaked onto the website. Same origin, same key, one session — a genuine
 * privilege leak.
 *
 * ## The fix
 *
 * Each surface gets its own named Firebase app, so each gets its own
 * persistence key and therefore its own independent session:
 *
 *     website  → app name "[DEFAULT]"          key …:<apiKey>:[DEFAULT]
 *     app      → app name "vidnov-app"         key …:<apiKey>:vidnov-app
 *     admin    → app name "vidnov-admin"       key …:<apiKey>:vidnov-admin
 *
 * All point at the same Firebase project, so the same accounts, the same
 * Firestore documents and the same security rules apply. Only the *session* is
 * separate: signing in on one surface never signs in the others.
 *
 * ## Three surfaces, not two
 *
 * Administration is deliberately its OWN application (`/admin`), not a tab in
 * the website. That means an admin signs in to a different place with a
 * different session, and — enforced in `src/components/auth/surface-boundary.tsx`
 * — the three surfaces refuse each other's roles:
 *
 *   • admin account on the consumer app  → signed out of the app
 *   • seller/buyer on the admin console  → signed out of the admin console
 *   • nobody reaches /admin without an admin role in their profile
 *
 * A stolen phone therefore grants nothing, and a compromised consumer session
 * cannot be replayed into the admin console, because the tokens are stored
 * under different keys entirely.
 *
 * ## Why the surface is latched, not derived from the URL
 *
 * The surface decides which Firebase app — and therefore which auth session —
 * a document load boots. It is resolved once per browsing context and stored
 * in `sessionStorage`, seeded from the URL the context was *opened* at:
 *
 *   • The installed app launches at `/app-preview` (the manifest `start_url`),
 *     so it always boots the app session.
 *   • The website boots at `/`, so it always boots the website session.
 *   • An installed window is recognised by its display mode as well as its
 *     path, because Android and iOS both restore the *last route* rather than
 *     `start_url` when the home-screen icon is tapped.
 *   • From then on the surface never changes for that tab/window. The app can
 *     navigate to `/cart`, `/requests`, `/live`… and keep the same session,
 *     because the Firebase app was chosen once and a client-side route change
 *     does not re-run it.
 *
 * Switching surfaces is therefore always an explicit, user-initiated hard
 * navigation (`openAppSurface` / `openWebSurface`), never a route change. A
 * reload alone is not a switch: reloading `/cart` inside the app stays in the
 * app, which is what a user expects.
 *
 * Firestore is deliberately shared — data is data. Sessions are not.
 */

/** Which UI the current browsing context belongs to. */
export type Surface = 'web' | 'app' | 'admin';

/**
 * Named app instances. The website deliberately keeps the reserved
 * `[DEFAULT]` name so every existing call site — including any code using the
 * no-argument `getAuth()` — keeps working untouched.
 */
export const SURFACE_APP_NAMES: Record<Surface, string> = {
  web: '[DEFAULT]',
  app: 'vidnov-app',
  admin: 'vidnov-admin',
};

/** Routes that mean "this context is the installed app". */
export const APP_SURFACE_PREFIXES = ['/app-preview', '/app'] as const;

/** Routes that mean "this context is the admin console". */
export const ADMIN_SURFACE_PREFIXES = ['/admin'] as const;

/** The real app's root. `/app-preview` still resolves here (it redirects). */
export const APP_PATH = '/app';

/** Where the installed app launches, and where "open the app" goes. */
export const APP_LAUNCH_PATH = APP_PATH;

/** Where the admin console lives and launches. */
export const ADMIN_PATH = '/admin';

const LATCH_KEY = 'vidnov.surface';

/** True when a pathname identifies the app surface. */
export function isAppPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return APP_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** True when a pathname identifies the admin console surface. */
export function isAdminPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ADMIN_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * The surface implied by a pathname — used only to *seed* a fresh context.
 */
export function surfaceForPathname(pathname: string | null | undefined): Surface {
  if (isAdminPathname(pathname)) return 'admin';
  if (isAppPathname(pathname)) return 'app';
  return 'web';
}

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    // Private mode / blocked storage: fall back to deriving from the URL, which
    // is correct on first load and merely less sticky afterwards.
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Non-fatal: see readStorage.
  }
}

/**
 * True when this window is the *installed app* rather than a browser tab.
 *
 * An installed window is the one place where the URL is a poor guide to the
 * surface. Android restores the last route (not `start_url`) when the icon is
 * tapped, iOS reopens wherever the user left off, and a manifest shortcut can
 * point anywhere. So `/cart` or `/search` opened from the home-screen icon
 * would boot the *website* session inside the app window — the app looking
 * exactly like the website, with the wrong account signed in. The display mode
 * is the honest signal: if the OS says this is a standalone window, it is the
 * app, whatever the path says.
 */
function isInstalledAppWindow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    if (standaloneQuery?.matches) return true;
    // iOS Safari reports the same thing through a non-standard property.
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/**
 * The surface for this browsing context, latching on first call.
 *
 * Must return the same value for the whole lifetime of the document, because
 * `initializeFirebase()` consumes it once to pick the Firebase app.
 */
export function resolveSurface(): Surface {
  if (typeof window === 'undefined') return 'web';

  const latched = readStorage(LATCH_KEY);
  if (latched === 'app' || latched === 'web' || latched === 'admin') return latched;

  // An installed window is always the app, even when it was restored onto a
  // shared website route. The admin console keeps its own identity: it is a
  // separate application, and mislabelling it would hand admins the app's
  // session.
  const surface =
    isInstalledAppWindow() && !isAdminPathname(window.location.pathname)
      ? 'app'
      : surfaceForPathname(window.location.pathname);

  writeStorage(LATCH_KEY, surface);
  return surface;
}

/**
 * Roles the consumer app accepts.
 *
 * The app is finished one section at a time, and each section ships with its
 * own route tree, shell and design system (`/app/seller`, `/app/buyer`). A role
 * is admitted exactly when the section built for it exists, so this array is
 * both the welcome list and the gate: an account whose section is not built is
 * signed straight back out with an explanation, and nothing about that account
 * is deleted or disabled — it keeps working normally on the website.
 *
 * `reseller` is admitted alongside `seller` because a reseller is a seller of
 * somebody else's catalogue and shares the seller section's workspace, products,
 * orders and earnings screens.
 *
 * Admin is deliberately never listed: the admin console is a separate
 * application with its own session, so an admin can never enter either app
 * section on the phone.
 */
export const APP_ALLOWED_ROLES = ['seller', 'reseller', 'buyer'] as const;

export function isRoleAllowedOnApp(role: string | null | undefined): boolean {
  if (!role) return false;
  return (APP_ALLOWED_ROLES as readonly string[]).includes(role);
}

/** The only role the admin console accepts. */
export function isRoleAllowedOnAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Leaves the current surface's session context and boots the other one.
 *
 * This clears the latch and performs a full document load, so surface
 * detection re-seeds from the destination. The destination surface starts
 * signed out — that is the point: the two sessions never merge.
 */
function switchSurface(href: string): void {
  if (typeof window === 'undefined') return;
  writeStorage(LATCH_KEY, null);
  window.location.assign(href);
}

/** Opens the app as its own, separate session. */
export function openAppSurface(href: string = APP_LAUNCH_PATH): void {
  if (isAppPathname(href)) {
    writeStorage(LATCH_KEY, 'app');
    window.location.assign(href);
    return;
  }
  switchSurface(href);
}

/** Opens the website as its own, separate session. */
export function openWebSurface(href: string = '/'): void {
  switchSurface(href);
}

/** Opens the admin console as its own, separate session. */
export function openAdminSurface(href: string = ADMIN_PATH): void {
  switchSurface(href);
}
