'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Loader2,
  MessageCircle,
  PlugZap,
  Send,
  Unplug,
} from 'lucide-react';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * WHATSAPP ALERTS (`/dashboard/admin/system/whatsapp-alerts`).
 *
 * Pair your own phone once — scan the QR with WhatsApp (Linked devices) — and
 * every payment and order change is delivered to your personal WhatsApp as a
 * message from yourself, so nothing to configure afterwards. The bridge runs
 * on this server (see `lib/whatsapp/bridge.ts`); the page is only a remote
 * control: it polls the pairing state while the QR is live.
 */

interface Status {
  state: 'idle' | 'connecting' | 'qr' | 'ready' | 'error';
  qr?: string;
  error?: string;
  pairedWith?: string;
}

export default function WhatsAppAlertsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const call = React.useCallback(
    async (action?: 'connect' | 'disconnect' | 'test') => {
      if (!user) return null;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/whatsapp', {
        method: action ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(action ? { 'Content-Type': 'application/json' } : {}),
        },
        body: action ? JSON.stringify({ action }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      return data as Status;
    },
    [user],
  );

  // Initial status + poll while the QR is on screen (it appears a few seconds
  // after "connect", and rotates while unscanned).
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await call();
        if (!cancelled && s) setStatus(s);
      } catch {
        // Polling failures are transient; keep the last known state.
      }
    };
    void tick();
    const interval = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, call]);

  const run = async (action: 'connect' | 'disconnect' | 'test', label: string) => {
    setBusy(label);
    try {
      const s = await call(action);
      if (s) setStatus(s);
      if (action === 'test') {
        toast({ title: 'Test message sent', description: 'Check your WhatsApp — it should be there.' });
      }
      if (action === 'disconnect') {
        toast({ title: 'Phone disconnected', description: 'Alerts will stop until you pair again.' });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-2xl">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold tracking-tight">WhatsApp Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Get payment and order alerts as WhatsApp messages on your own phone — the same
            buzz you already notice all day. Pair once; the bridge runs on this server.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Connection</h2>
            </div>
            <Badge
              variant="outline"
              className={
                status?.state === 'ready'
                  ? 'border-green-500/40 text-green-500'
                  : status?.state === 'error'
                    ? 'border-red-500/40 text-red-500'
                    : 'text-muted-foreground'
              }
            >
              {status?.state === 'ready'
                ? 'Connected'
                : status?.state === 'qr' || status?.state === 'connecting'
                  ? 'Waiting for scan…'
                  : status?.state === 'error'
                    ? 'Error'
                    : 'Not connected'}
            </Badge>
          </div>

          {status?.pairedWith && status.state === 'ready' && (
            <p className="mt-3 text-sm text-muted-foreground">
              Paired with <span className="font-mono">+{status.pairedWith}</span>. You'll get
              alerts here for payments received and every order status change.
            </p>
          )}

          {status?.state === 'error' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{status.error || 'The connection failed. Try connecting again.'}</span>
            </div>
          )}

          {/* QR pairing */}
          {(status?.state === 'qr' || status?.state === 'connecting') && (
            <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6">
              {status.qr ? (
                <>
                  <div className="relative h-56 w-56 overflow-hidden rounded-xl bg-white p-2">
                    <Image src={status.qr} alt="WhatsApp pairing code" fill className="object-contain p-2" unoptimized />
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap <span className="font-medium text-foreground">Linked devices</span></li>
                    <li>Point the camera at this code</li>
                  </ol>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm">Preparing your pairing code…</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {(status?.state === 'idle' || status?.state === 'error') && (
              <Button onClick={() => run('connect', 'connect')} disabled={busy !== null}>
                {busy === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                Connect my phone
              </Button>
            )}
            {status?.state === 'ready' && (
              <>
                <Button variant="outline" onClick={() => run('test', 'test')} disabled={busy !== null}>
                  {busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send test message
                </Button>
                <Button variant="outline" onClick={() => run('disconnect', 'disconnect')} disabled={busy !== null}>
                  {busy === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Delivered by a WhatsApp Web session kept on this server, so no third-party alert
          service sees your data. Keep messages low-volume (alerts only) to stay within
          WhatsApp's rules for linked devices.
        </p>
      </div>
    </AdminLayout>
  );
}
