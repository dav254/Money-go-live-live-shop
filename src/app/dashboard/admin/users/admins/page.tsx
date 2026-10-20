'use client';

import * as React from 'react';
import {
  AlertTriangle, Loader2, RefreshCw, Search, ShieldCheck, ShieldOff, UserPlus, WifiOff,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { FirestorePermissionError, FirestoreUnavailableError } from '@/firebase/errors';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';

/**
 * ADMIN TEAM (`/dashboard/admin/users/admins`).
 *
 * The platform starts with one admin. This is the screen that grows the team:
 * promote an existing registered user to admin, or demote one back. Every
 * change goes through `/api/admin/users/{uid}/role`, which enforces the two
 * rules rules cannot express — you cannot change your own role, and the last
 * admin cannot be demoted — so this screen stays a thin, honest list.
 *
 * ## Why the data layer was rebuilt
 *
 * The previous version ignored `useCollection`'s `error` entirely. Every
 * failure — a rules denial, a quota blowout (`resource-exhausted`), a dead
 * connection — collapsed into the same screen: a spinner that resolved into
 * "No admins found — something is wrong with this account's role." That copy
 * blamed the account for what was almost never the account, and it gave the
 * operator no way to tell the three cases apart or to retry.
 *
 * The page now branches on the actual failure:
 *
 *   - `FirestorePermissionError` (rules said no)  → say which, and how to fix
 *     the session (sign out/in; role must be `admin` on your profile).
 *   - `FirestoreUnavailableError` (quota/offline) → say it is NOT permissions,
 *     show the SDK code, offer Retry — which resubscribes the snapshot.
 *   - Loaded and genuinely empty                  → the impossible case (you
 *     passed the admin gate, so your own profile must be in the list), stated
 *     as such instead of a vague accusation.
 *
 * Admins are found by `userRole` with the legacy `role` field as fallback
 * (`userRole || role`), the same resolution the rest of the app uses.
 */

const roleOf = (u: UserProfile) => u.userRole || u.role;

export default function AdminTeamPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [search, setSearch] = React.useState('');
  const [pendingUid, setPendingUid] = React.useState<string | null>(null);
  // Bumped by Retry: a fresh collection ref makes useCollection tear down the
  // failed snapshot listener and subscribe again.
  const [retryToken, setRetryToken] = React.useState(0);

  const usersQuery = React.useMemo(
    () => (firestore ? collection(firestore, 'userProfiles') : null),
    [firestore, retryToken],
  );
  const { data: users, isLoading, error } = useCollection<UserProfile>(usersQuery);

  const allUsers = users ?? [];
  const admins = React.useMemo(
    () => allUsers.filter((u) => roleOf(u) === 'admin'),
    [allUsers],
  );

  const permissionDenied = error instanceof FirestorePermissionError;
  const unavailable = error instanceof FirestoreUnavailableError;
  const sdkCode = unavailable ? (error as FirestoreUnavailableError).code : null;

  const suggestions = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle || error) return [];
    return allUsers
      .filter((u) => u.id !== user?.uid && roleOf(u) !== 'admin')
      .filter(
        (u) =>
          (u.fullName || '').toLowerCase().includes(needle) ||
          (u.email || '').toLowerCase().includes(needle) ||
          (u.username || '').toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [allUsers, search, user?.uid, error]);

  const setRole = async (uid: string, role: 'admin' | 'buyer' | 'seller' | 'reseller') => {
    if (!user) return;
    setPendingUid(uid);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${uid}/role`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not change the role.');
      toast({
        title: role === 'admin' ? 'Admin added' : 'Admin removed',
        description:
          role === 'admin'
            ? 'They can now sign in to the admin console and help you run the platform.'
            : 'Their admin access has been removed.',
      });
      if (role === 'admin') setSearch('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not change the role',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setPendingUid(null);
    }
  };

  /* ------------------------------------------------------------------ states */

  const retry = () => setRetryToken((t) => t + 1);

  const errorCard = error && !isLoading && (
    <div className="m-5 rounded-xl border border-orange-500/40 bg-orange-500/5 p-5">
      <div className="flex items-start gap-3">
        {permissionDenied ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        ) : (
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-orange-600">
            {permissionDenied
              ? 'Firestore denied this read'
              : 'Data service unreachable'}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {permissionDenied ? (
              <>
                The security rules refused to list <code className="font-mono">userProfiles</code>{' '}
                for this session. Sign out and back in so your admin role is on the token; if it
                still fails, your profile document may not have <code className="font-mono">userRole: &quot;admin&quot;</code>.
              </>
            ) : (
              <>
                The request never reached Firestore{sdkCode ? ` (code: ${sdkCode})` : ''} — this is
                a connection or quota problem, <span className="font-semibold">not</span> a
                permissions problem, and it is not your account&apos;s role. If it persists, check
                the project&apos;s Firestore quota/billing in the Firebase console.
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </div>
  );

  const body = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      );
    }
    if (error) return errorCard;
    if (admins.length === 0) {
      // You passed AdminLayout's role gate to get here, so a successfully
      // loaded list that contains no admin can only mean your own profile
      // document is missing or unreadable — say exactly that.
      return (
        <div className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">
            The users list loaded but contains no admin profile — your own account should appear
            here. Sign out and in again; if it persists, your <code className="font-mono">userProfiles</code>{' '}
            document is missing its admin role.
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
        </div>
      );
    }
    return (
      <div className="divide-y divide-border">
        {admins.map((admin) => {
          const isSelf = admin.id === user?.uid;
          return (
            <div key={admin.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={admin.profilePictureUrl} />
                <AvatarFallback>{(admin.fullName || '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {admin.fullName || 'Unnamed user'}
                  {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-primary">
                <ShieldCheck className="mr-1 h-3 w-3" /> Admin
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isSelf || pendingUid === admin.id}
                title={
                  isSelf
                    ? 'You cannot change your own role — ask another admin.'
                    : 'Remove admin access'
                }
                onClick={() => setRole(admin.id, 'buyer')}
              >
                {pendingUid === admin.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShieldOff className="mr-1 h-3 w-3" />
                )}
                Remove
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  /* -------------------------------------------------------------------- view */

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold tracking-tight">Admin Team</h1>
          <p className="text-sm text-muted-foreground">
            Admins can manage users, orders, products and settings. Promote people you trust —
            you can always take the access away again.
          </p>
        </div>

        {/* Current admins */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Current admins {error || isLoading ? '' : `(${admins.length})`}
              </h2>
            </div>
            {!isLoading && !error && (
              <Button variant="ghost" size="sm" onClick={retry} title="Reload the list">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh
              </Button>
            )}
          </div>
          {body()}
        </section>

        {/* Promote someone */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Add an admin</h2>
          </div>
          <div className="space-y-3 p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a registered user by name, username or email…"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only people who already have an account appear here — ask them to register first,
              then promote them.
            </p>
            {suggestions.length > 0 && (
              <div className="divide-y divide-border rounded-xl border border-border">
                {suggestions.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.profilePictureUrl} />
                      <AvatarFallback>{(u.fullName || '?').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.fullName || 'Unnamed user'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email} · currently {roleOf(u) || 'no role'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={pendingUid === u.id}
                      onClick={() => setRole(u.id, 'admin')}
                    >
                      {pendingUid === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserPlus className="mr-1 h-3 w-3" />
                      )}
                      Make admin
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {search.trim() && suggestions.length === 0 && !isLoading && !error && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No registered users match “{search.trim()}”.
              </p>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Safety rails, enforced on the server: an admin can never change their own role, and the
          last admin can never be demoted — so you can&apos;t lock yourself out.
        </p>
      </div>
    </AdminLayout>
  );
}
