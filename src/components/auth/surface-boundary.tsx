'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth, useSurface, useUser, useUserProfile } from '@/firebase';
import {
  isRoleAllowedOnAdmin,
  isRoleAllowedOnApp,
  openWebSurface,
} from '@/lib/auth/surface';
import { resolveRole } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Loader2, ArrowRight } from 'lucide-react';

/**
 * SURFACE BOUNDARY — who may use which application.
 *
 * Sessions are separated at the storage layer: each surface owns a distinct
 * named Firebase app, so each keeps its own auth session (see
 * `src/lib/auth/surface.ts`). Signing in on the website never signs in the app,
 * and neither ever signs in the admin console.
 *
 * This component enforces the rule storage cannot express — that the *people*
 * are separated too, in both directions:
 *
 *   • admin on the app           → signed out (admins have their own console)
 *   • seller/buyer on /admin      → signed out (no admin console without admin)
 *
 * Signing out here touches only the *current* surface's Auth instance, so an
 * admin's website session in another tab is left intact.
 *
 * ── One section per role ─────────────────────────────────────────────────────
 * Each role gets its own section with its own route tree, layout and design —
 * `/app/seller` and `/app/buyer` share nothing, and the role list in
 * `APP_ALLOWED_ROLES` admits a role only once its section exists. Admin is
 * never on that list: the admin console is a separate application with its own
 * sign-in, so an admin who signs in on the phone is signed back out with an
 * explanation rather than a silent failure — otherwise it reads as a broken
 * password. Their website and console accounts are untouched and keep working;
 * the phone app is simply not their surface. The role list lives in
 * `APP_ALLOWED_ROLES`.
 *
 * This is a usability and blast-radius control, not the authorization
 * boundary: the real enforcement is the role check on every admin API and the
 * Firestore rules, neither of which depends on the browser being honest.
 *
 * ── A role that has not been read yet is not a role that is refused ────────
 * This boundary only acts on a role it has actually read. `resolveRole`
 * returns null while the profile is unknown, and "unknown" covers three very
 * different things: still loading, a failed read, and a profile with no role on
 * it. Signing somebody out on the strength of a null role signed real sellers
 * out of the app the moment they logged in — their profile simply had not
 * arrived yet. So null is never a verdict: the user is left signed in, and if
 * the profile is still unreadable once loading has finished they get a retry
 * screen instead of a rejection.
 */
export function SurfaceBoundary({ children }: { children: React.ReactNode }) {
  const surface = useSurface();
  const auth = useAuth();
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const [blocked, setBlocked] = useState<null | 'app' | 'admin'>(null);

  // Fallback profile read SERVER-side (Firestore → local VPS store) when the
  // client-side read comes back empty — real sellers were stuck on the retry
  // screen because the browser's Firestore read failed while the profile
  // existed (or could be created) on the server.
  const [serverProfile, setServerProfile] = useState<{ userRole?: string; role?: string } | null>(null);
  // True once the server read has confirmed the profile is missing EVERYWHERE
  // — only then is "complete your account" offered (a role must never be
  // guessed for an account that already has one).
  const [needsRepair, setNeedsRepair] = useState(false);
  const serverLookupDone = useRef(false);

  const role = resolveRole(userProfile) ?? resolveRole(serverProfile);
  // `surface === null` means the surface is not known yet (SSR / first paint).
  // Blocking on it would sign people out before we know which app they are in.
  const settled = surface !== null && !isLoading && !isProfileLoading;

  // A role we could not read is NOT the same thing as a role that is not
  // allowed. `resolveRole` returns null for an unresolved profile — the read
  // failed, or the document has not arrived — and this boundary used to treat
  // that as "no section" and sign the account out. Sellers were hitting exactly
  // that: a perfectly good seller profile that had not loaded in the one render
  // between sign-in and the profile snapshot. So we only judge a role we have
  // actually read; until then the user is left alone.
  const roleResolved = role !== null;

  // Signed in, still resolving, and the read came back with nothing usable.
  // Nobody is signed out for this — the session is fine, the profile is not —
  // so offer a retry instead of a "wrong role" verdict that cannot be trusted.
  const unreadable = !!user && settled && !roleResolved;

  // One server-side lookup per mount when the client read came up empty.
  useEffect(() => {
    if (!user || !unreadable || serverLookupDone.current) return;
    serverLookupDone.current = true;
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } }),
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) setServerProfile(data.profile);
        else setNeedsRepair(true);
      })
      .catch(() => setNeedsRepair(true));
  }, [user, unreadable]);

  // Repair path for an account with NO profile in either store (the old
  // client-side signup write failed after Auth had already created the
  // account). The user picks the section they signed up for; the server
  // creates the profile in both stores and the reload lands them there.
  const completeProfile = (chosenRole: 'buyer' | 'seller') => {
    if (!user) return;
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: chosenRole, name: user.displayName || undefined }),
        }),
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) window.location.reload();
      })
      .catch(() => {});
  };

  // Which surface, if any, this role has no business being on.
  const forbidden =
    !user || !settled || !roleResolved
      ? null
      : surface === 'app' && !isRoleAllowedOnApp(role)
        ? 'app'
        : surface === 'admin' && !isRoleAllowedOnAdmin(role)
          ? 'admin'
          : null;

  useEffect(() => {
    if (!forbidden) return;
    setBlocked(forbidden);
    signOut(auth).catch(() => {});
  }, [forbidden, auth]);

  if (unreadable) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="font-grotesk text-lg font-semibold text-foreground">
            We couldn&apos;t load your account
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            You are signed in, but your profile did not load, so we can&apos;t tell
            which section to open yet. You have not been signed out and nothing
            has been changed — try again.
          </p>
        </div>

        <Button onClick={() => window.location.reload()}>
          Try again
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {/* Only after the server has confirmed the profile is missing in
            BOTH stores: let the person finish the account they already own
            by saying which section they signed up for. This is what un-sticks
            accounts stranded by a failed signup write. */}
        {needsRepair && (
          <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-border bg-card p-4 text-left">
            <p className="text-sm font-medium text-foreground">
              This account was created but its profile was never saved.
              Which section did you sign up for?
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => completeProfile('seller')}>
                Seller
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => completeProfile('buyer')}
              >
                Buyer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your account and login stay exactly the same — this only restores
              your profile.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!forbidden && !blocked) return <>{children}</>;

  const onAdmin = blocked === 'admin';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {blocked ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ShieldAlert className="h-6 w-6 text-destructive" />
        )}
      </div>

      <div className="space-y-2">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          {onAdmin ? 'Administrator access only' : 'This account has no app section yet'}
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {onAdmin
            ? 'The admin console is a separate application with its own sign-in. Sellers and buyers cannot enter it.'
            : 'The phone app is split into one section per role, and this account\u2019s section is not open yet. You have been signed out of the app — your website account is unaffected and still works everywhere else.'}
        </p>
      </div>

      {/* Only the admin console keeps a way out to the website.

          On the app this button offered the one route out of the application to
          someone who had just been signed out of it — saying out loud that the
          app cannot do what the website does, which is the opposite of what the
          split into per-role sections is for. The app explains the refusal and
          stops there.

          The admin console is a different application with its own sign-in, so
          its users are not "in the app" and their escape is their business. */}
      {onAdmin && (
        <Button onClick={() => openWebSurface('/')} disabled={!!blocked}>
          Go to the website
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}