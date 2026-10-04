'use client';

/**
 * NOTIFICATION SETTINGS (`/app/buyer/settings/notifications`).
 *
 * ## The two things this does
 *
 * 1. **Turn phone notifications on.** This is the switch that matters most on a
 *    PWA, and it cannot be pre-granted: the browser only shows its permission
 *    prompt in response to a real user gesture, so the button below is the
 *    only place the prompt can ever be triggered from. It is deliberately not
 *    fired from an effect on mount — Chrome silently drops that, and the
 *    button appears broken.
 *
 * 2. **Choose which sections buzz.** One switch per section, using the same
 *    category list the delivery path checks, so what is toggled here is
 *    literally what is consulted before a send.
 *
 * ## The awkward states are the point
 *
 * Push has more failure modes than a normal toggle, and each needs honest
 * wording, or the screen becomes a liar:
 *
 *   - `denied` — the user said no at the OS level. Re-prompting does nothing,
 *     so we say where to undo it instead of showing a button that will not work.
 *   - `unsupported` — desktop Safari, or a browser without the Push API.
 *   - unconfigured — no VAPID key. A server problem that would otherwise look
 *     like the user's phone being broken.
 *
 * Each state is reported separately rather than collapsed into "failed".
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, BellOff, Check, Loader2, ShieldCheck, Smartphone, Zap,
} from 'lucide-react';

import { useUser } from '@/firebase';
import { PUSH_CATEGORIES, type PushCategory } from '@/lib/notifications/push-preferences';
import {
  disablePush, enablePush, pushSupport, type PushSupport,
} from '@/lib/notifications/push-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  BuyerCard, BuyerSectionTitle, BuyerStatusPill,
} from '@/components/app/buyer/buyer-app-shell';
import { cn } from '@/lib/utils';

type Panel = 'unsupported' | 'denied' | 'default' | 'granted';

export function PushSettingsScreen() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [support, setSupport] = React.useState<PushSupport | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prefs, setPrefs] = React.useState<Partial<Record<PushCategory, boolean>>>({});
  const [savingKey, setSavingKey] = React.useState<PushCategory | null>(null);

  React.useEffect(() => {
    void pushSupport().then(setSupport);
  }, []);

  // Load saved preferences. Failure here is not worth an error toast — the
  // toggles fall back to their defaults, which is the same behaviour as a
  // first-time visit.
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/notifications/push/preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { categories?: Record<string, boolean> };
        if (alive && data.categories) setPrefs(data.categories);
      } catch {
        /* defaults are fine */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;
    setBusy(true);
    const result = await enablePush(user);
    setBusy(false);
    setSupport(await pushSupport());

    switch (result.status) {
      case 'enabled':
        toast({ title: 'Phone notifications on', description: 'You will get alerts on this device.' });
        break;
      case 'denied':
        toast({
          variant: 'destructive',
          title: 'Notifications blocked',
          description: 'Allow notifications for Vidnov in your browser settings.',
        });
        break;
      case 'unsupported':
        toast({ variant: 'destructive', title: 'This browser cannot receive notifications.' });
        break;
      default:
        toast({ variant: 'destructive', title: 'Could not turn notifications on', description: result.reason });
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    setBusy(true);
    await disablePush(user);
    setBusy(false);
    setSupport(await pushSupport());
    toast({ title: 'Phone notifications off', description: 'Removed from every device on your account.' });
  };

  /** Optimistic toggle, rolled back if the save fails. */
  const toggle = async (category: PushCategory) => {
    if (!user) return;
    const next = !(prefs[category] ?? true);
    const previous = prefs;
    setPrefs((p) => ({ ...p, [category]: next }));
    setSavingKey(category);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/notifications/push/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categories: { [category]: next } }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setPrefs(previous);
      toast({ variant: 'destructive', title: 'Could not save that change.' });
    } finally {
      setSavingKey(null);
    }
  };

  const on = (c: PushCategory) => prefs[c] !== false;

  return (
    <div className="vn-page-enter pb-8">
      <BuyerSectionTitle eyebrow="Stay in the loop" title="Notifications" />

      <div className="px-4">
        {/* ------------------------------------------------ the master switch */}
        <BuyerCard>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
              <Smartphone className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Alerts on this phone</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Get notified about orders, payments, messages and live streams — even when the
                app is closed.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {support === null ? (
              <div className="flex h-11 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : support === 'unsupported' ? (
              <Panel
                tone="muted"
                icon={BellOff}
                title="Not supported here"
                body="This browser cannot show notifications. Try the app installed from your home screen, or Chrome on Android."
              />
            ) : support === 'denied' ? (
              <Panel
                tone="warn"
                icon={BellOff}
                title="Blocked"
                body="Notifications are turned off for Vidnov. Re-enable them in your browser settings — this page cannot ask again."
              />
            ) : support === 'granted' ? (
              <Button
                onClick={handleDisable}
                disabled={busy}
                variant="outline"
                className="h-11 w-full rounded-2xl border-white/10 bg-white/5 font-semibold text-foreground hover:bg-white/10"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
                Turn off on all devices
              </Button>
            ) : (
              <Button
                onClick={handleEnable}
                disabled={busy}
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold text-white"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Turn on notifications
              </Button>
            )}
          </div>

          {support === 'granted' && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              On for this account on every device it is signed into.
            </p>
          )}
        </BuyerCard>
      </div>

      {/* --------------------------------------------------- per-section */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            What you get alerted about
          </p>

          <ul className="mt-3 divide-y divide-border/60">
            {PUSH_CATEGORIES.map((cat) => {
              const enabled = on(cat.id);
              const saving = savingKey === cat.id;
              return (
                <li key={cat.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {cat.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${cat.label} notifications`}
                    disabled={saving}
                    onClick={() => toggle(cat.id)}
                    className={cn(
                      'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60',
                      enabled
                        ? 'bg-gradient-to-r from-cyan-400 to-violet-500'
                        : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                        enabled ? 'left-6' : 'left-1',
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </BuyerCard>
      </div>

      {/* --------------------------------------------------------- note */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Security alerts — a new sign-in or a password change — always reach you, even
              with everything above switched off. In-app notifications are unaffected either
              way, so nothing is ever lost by turning these off.
            </p>
          </div>
        </BuyerCard>
      </div>

      <div className="mt-4 px-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/app/buyer/notifications')}
          className="w-full rounded-2xl text-sm text-muted-foreground"
        >
          <Zap className="mr-2 h-4 w-4" />
          See everything that already happened
        </Button>
      </div>
    </div>
  );
}

/** A non-interactive explanation block for the states that need one. */
function Panel({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: 'muted' | 'warn';
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-3',
        tone === 'warn' ? 'bg-amber-500/10' : 'bg-muted/50',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground',
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
