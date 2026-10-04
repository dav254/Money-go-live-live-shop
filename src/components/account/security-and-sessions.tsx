'use client';

/**
 * SecurityAndSessions — the sessions + password management UI extracted
 * from /dashboard/security so it can render inside the Account page's
 * "Security" tab while the standalone page remains for direct links.
 */

import * as React from 'react';
import {
  Smartphone, Monitor, Globe, Loader2, LogOut, KeyRound, BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useUser, useAuth } from '@/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';

interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  current: boolean;
  lastActive: string | null;
  createdAt: string | null;
}

function DeviceIcon({ device }: { device: string }) {
  if (/android|ios/i.test(device)) return <Smartphone className="h-4 w-4" />;
  if (/chrome|firefox|safari|edge/i.test(device)) return <Globe className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export function SecurityAndSessions() {
  const { user, isLoading: isUserLoading } = useUser();
  // Surface-scoped auth: the website and the installed app each keep their own
  // session, so password changes must target the current surface's user.
  const auth = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = React.useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(true);
  const [busySession, setBusySession] = React.useState<string | null>(null);

  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [changingPassword, setChangingPassword] = React.useState(false);

  // ---- Sessions ----
  const loadSessions = React.useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.ok) setSessions(data.sessions ?? []);
      // Register / refresh current device (fires new-login email for new devices).
      await fetch('/api/auth/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // Silent — the section simply shows empty.
    } finally {
      setSessionsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  // ---- Password change (client SDK, requires re-auth) ----
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    // Surface-scoped: each UI has its own auth session.
    const current = auth.currentUser;
    if (!current) return;
    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Use at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    setChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(current.email ?? '', oldPassword);
      await reauthenticateWithCredential(current, cred);
      await updatePassword(current, newPassword);
      // Notify through the engine (mandatory security category).
      fetch('/api/auth/notify-password-changed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await current.getIdToken()}` },
      }).catch(() => {});
      toast({ title: 'Password updated', description: 'Other sessions have been signed out for safety.' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      const code = error?.code ?? '';
      toast({
        variant: 'destructive',
        title: code.includes('wrong-password') || code.includes('invalid-credential')
          ? 'Current password is incorrect'
          : 'Could not change password',
        description: code.includes('weak-password') ? 'Choose a stronger password.' : undefined,
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setBusySession(sessionId);
    try {
      const idToken = await user?.getIdToken();
      await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({ title: 'Device signed out' });
    } finally {
      setBusySession(null);
    }
  };

  const revokeAllOthers = async () => {
    setBusySession('all');
    try {
      const idToken = await user?.getIdToken();
      await fetch('/api/auth/sessions?allOthers=1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setSessions(prev => prev.filter(s => s.current));
      toast({ title: 'All other devices signed out' });
    } finally {
      setBusySession(null);
    }
  };

  if (isUserLoading) {
    return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ============ ACTIVE SESSIONS ============ */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="font-grotesk text-lg flex items-center gap-2"><Smartphone className="h-4.5 w-4.5 text-primary" /> Active sessions</CardTitle>
            <CardDescription>Devices currently signed in to your account.</CardDescription>
          </div>
          {sessions.filter(s => !s.current).length > 0 && (
            <Button variant="outline" size="sm" className="rounded-lg font-semibold" onClick={revokeAllOthers} disabled={busySession === 'all'}>
              {busySession === 'all' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Log out all others
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? (
            <><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No devices tracked yet — this page registers your current device.</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} className={cn('flex items-center justify-between rounded-xl border p-4', s.current ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                <div className="flex items-center gap-3.5">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', s.current ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    <DeviceIcon device={s.device} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {s.device}
                      {s.current && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">This device</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Last active: {s.lastActive ? formatDistanceToNow(new Date(s.lastActive), { addSuffix: true }) : 'recently'}
                    </p>
                  </div>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" className="rounded-lg text-[12px] font-semibold text-destructive hover:text-destructive" onClick={() => revokeSession(s.id)} disabled={busySession === s.id}>
                    {busySession === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LogOut className="mr-1.5 h-3.5 w-3.5" /> Log out</>}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ============ CHANGE PASSWORD ============ */}
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="font-grotesk text-lg flex items-center gap-2"><KeyRound className="h-4.5 w-4.5 text-primary" /> Change password</CardTitle>
          <CardDescription>You’ll confirm your current password first. Other sessions are signed out after a change.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="acc-old">Current password</Label>
              <Input id="acc-old" type="password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-new">New password</Label>
              <Input id="acc-new" type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-confirm">Confirm new password</Label>
              <Input id="acc-confirm" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button type="submit" disabled={changingPassword} className="h-11 rounded-xl font-semibold">
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
        Security &amp; account-recovery emails are always sent — they keep your account safe.
      </p>
    </div>
  );
}
