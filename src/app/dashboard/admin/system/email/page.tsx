'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

interface EmailStatus {
  mode: 'development' | 'production';
  provider: string | null;
  delivering: boolean;
  from: string;
  replyTo: string;
  appUrl: string;
  mailboxes: Record<string, string>;
  requiredKeys: { key: string; set: boolean }[];
  templates: { key: string; subject: string; category: string }[];
  captured: { id: string; to: string; subject: string; createdAt: string | null }[];
}

interface EmailLogRow {
  id: string;
  to: string;
  from: string;
  subject: string;
  template: string;
  status: string;
  provider: string;
  providerId: string | null;
  failureReason: string | null;
  errorClass: string | null;
  createdAt: string | null;
  devMode: boolean;
}

interface SuppressionRow {
  address: string;
  reason: string;
  source: string;
  createdAt: string | null;
}

interface WebhookEventRow {
  id: string;
  type: string;
  messageId: string | null;
  address: string | null;
  status: string | null;
  receivedAt: string | null;
}

const LOG_STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400',
  SENT: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-600 dark:text-cyan-300',
  DELAYED: 'border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-300',
  BOUNCED: 'border-red-500/40 bg-red-500/10 text-red-500',
  FAILED: 'border-red-500/40 bg-red-500/10 text-red-500',
  SKIPPED: 'border-white/20 bg-white/5 text-muted-foreground',
  SENDING: 'border-white/20 bg-white/5 text-muted-foreground',
  QUEUED: 'border-white/20 bg-white/5 text-muted-foreground',
};

const LOG_PAGE_SIZE = 10;
const LOG_FILTERS = ['', 'DELIVERED', 'SENT', 'DELAYED', 'BOUNCED', 'FAILED', 'SKIPPED'];

export default function AdminEmailSettingsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [recipient, setRecipient] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [logs, setLogs] = React.useState<EmailLogRow[]>([]);
  const [logPage, setLogPage] = React.useState(0);
  const [logStatus, setLogStatus] = React.useState('');
  const [logLoading, setLogLoading] = React.useState(false);
  const [suppressions, setSuppressions] = React.useState<SuppressionRow[]>([]);
  const [webhookEvents, setWebhookEvents] = React.useState<WebhookEventRow[]>([]);

  // The API is admin-gated on a Bearer token — without it the request gets a
  // 403 and the page reported "status unavailable" no matter what env keys
  // existed, which read like a credentials problem when it was an auth one.
  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) throw new Error('This account is not an admin.');
      if (!res.ok) throw new Error('Could not load email status.');
      setStatus((await res.json()) as EmailStatus);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Email status unavailable',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sendTest = async () => {
    if (!recipient.trim() || !user) return;
    setSending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: recipient.trim(), templateKey: 'welcome' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Send failed.');
      toast({ title: 'Test email sent', description: data.message });
      void load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Send failed',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  const authHeaders = React.useCallback(async (): Promise<Record<string, string>> => {
    const token = await user!.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const loadLogs = React.useCallback(
    async (page: number, statusFilter: string) => {
      if (!user) return;
      setLogLoading(true);
      try {
        const params = new URLSearchParams({
          box: 'email-logs',
          limit: String(LOG_PAGE_SIZE),
          page: String(page),
        });
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/admin/communication?${params.toString()}`, {
          headers: await authHeaders(),
        });
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as { logs?: EmailLogRow[] };
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setLogPage(page);
        setLogStatus(statusFilter);
      } catch {
        setLogs([]);
      } finally {
        setLogLoading(false);
      }
    },
    [user, authHeaders],
  );

  const loadReliability = React.useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      const [sup, ev] = await Promise.all([
        fetch('/api/admin/communication?box=suppressions&limit=25', { headers }).then(r => r.json()),
        fetch('/api/admin/communication?box=webhook-events&limit=15', { headers }).then(r => r.json()),
      ]);
      setSuppressions(Array.isArray(sup?.suppressions) ? sup.suppressions : []);
      setWebhookEvents(Array.isArray(ev?.events) ? ev.events : []);
    } catch {
      /* both sections simply stay empty */
    }
  }, [user, authHeaders]);

  const unsuppress = async (address: string) => {
    try {
      const res = await fetch('/api/admin/communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'unsuppress', address }),
      });
      if (res.ok) {
        toast({ title: 'Suppression removed', description: address });
        void loadReliability();
      } else {
        toast({ variant: 'destructive', title: 'Could not update the suppression list.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Network error' });
    }
  };

  React.useEffect(() => {
    void loadLogs(0, '');
    void loadReliability();
  }, [loadLogs, loadReliability]);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Email Delivery</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How Vidnov sends password resets, welcome, order and business emails — and what is still
              missing before real messages leave the server.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} /> Refresh
          </Button>
        </div>

        {loading && !status && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading email configuration…
          </p>
        )}

        {status && (
          <>
            {/* Status banner */}
            <Card className={status.delivering ? 'border-emerald-500/40' : 'border-amber-500/40'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {status.delivering ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  {status.delivering ? 'Real emails are being delivered' : 'Emails are captured, not delivered'}
                </CardTitle>
                <CardDescription>
                  {status.delivering
                    ? `Every transactional email is sent through ${status.provider}.`
                    : `EMAIL_MODE is “${status.mode}”, so messages are stored in the development mailbox and nobody receives them. Set EMAIL_MODE=production with a provider and API key to go live.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Mode', value: status.mode },
                  { label: 'Provider', value: status.provider ?? 'not set' },
                  { label: 'From', value: status.from },
                  { label: 'Reply-To', value: status.replyTo },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-border px-4 py-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">{row.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Required configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration checklist</CardTitle>
                  <CardDescription>
                    Add these in Settings → Environment. Values are never shown here — only whether a
                    key is present.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {status.requiredKeys.map((key) => (
                    <div key={key.key} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                      <span className="font-mono text-xs">{key.key}</span>
                      {key.set ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> set
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> missing
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    The sender address must be on a domain you have verified with the provider, otherwise
                    password resets land in spam.
                  </div>
                </CardContent>
              </Card>

              {/* Test send */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Send a test email</CardTitle>
                  <CardDescription>
                    Sends the welcome template through the configured provider and reports the result.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-to">Recipient</Label>
                    <Input
                      id="test-to"
                      type="email"
                      placeholder="you@yourdomain.com"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={sendTest} disabled={sending || !recipient.trim()}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send test email
                  </Button>
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Role mailboxes
                    </p>
                    {Object.entries(status.mailboxes).map(([role, address]) => (
                      <p key={role} className="flex justify-between text-xs">
                        <span className="uppercase tracking-wide text-muted-foreground">{role}</span>
                        <span className="font-mono">{address}</span>
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Dev mailbox */}
            {status.mode === 'development' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Development mailbox</CardTitle>
                  <CardDescription>
                    The last {status.captured.length} messages the system “sent”. In production mode this
                    list disappears and real mail is dispatched.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {status.captured.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nothing captured yet. Trigger a password reset to see a message here.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {status.captured.map((mail) => (
                        <div key={mail.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{mail.subject}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">{mail.to}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">{mail.createdAt ?? ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery log — webhook-confirmed provider statuses */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Delivery log</CardTitle>
                  <CardDescription>
                    Every send with its provider message id and confirmed status. “Delivered” only
                    appears when the provider's webhook proves it — API acceptance alone never counts.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadLogs(logPage, logStatus)} disabled={logLoading}>
                  <RefreshCw className={logLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {LOG_FILTERS.map(s => (
                    <button
                      key={s || 'all'}
                      type="button"
                      onClick={() => void loadLogs(0, s)}
                      className={
                        logStatus === s
                          ? 'rounded-full border border-primary bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white'
                          : 'rounded-full border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition hover:text-foreground'
                      }
                    >
                      {s || 'all'}
                    </button>
                  ))}
                </div>

                {logLoading && logs.length === 0 ? (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading delivery log…
                  </p>
                ) : logs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No delivery records on this page.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {logs.map(row => (
                      <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.subject}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.to} · {row.template}
                            {row.devMode ? ' · dev capture' : ''}
                          </p>
                          {row.failureReason && (
                            <p className="mt-0.5 truncate text-[11px] text-destructive/80">
                              {row.errorClass ? `[${row.errorClass}] ` : ''}
                              {row.failureReason}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              LOG_STATUS_STYLES[row.status] ?? 'border-border text-muted-foreground'
                            }`}
                          >
                            {row.status}
                          </span>
                          <span className="max-w-[14rem] truncate font-mono text-[10px] text-muted-foreground">
                            {row.providerId ? `${row.providerId.slice(0, 12)}…` : row.provider}
                            {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString()}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logLoading || logPage === 0}
                    onClick={() => void loadLogs(logPage - 1, logStatus)}
                  >
                    ← Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {logPage + 1}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logLoading || logs.length < LOG_PAGE_SIZE}
                    onClick={() => void loadLogs(logPage + 1, logStatus)}
                  >
                    Next →
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reliability: suppressions + webhook events */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suppressed recipients ({suppressions.length})</CardTitle>
                  <CardDescription>
                    Hard bounces and spam complaints block all further email to these addresses — the
                    provider will not accept them anyway.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suppressions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing suppressed — every address is mailable.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {suppressions.map(s => (
                        <div
                          key={s.address}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{s.address}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {s.reason} · {s.source}
                              {s.createdAt ? ` · ${new Date(s.createdAt).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => void unsuppress(s.address)}>
                            Allow again
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery webhooks ({webhookEvents.length})</CardTitle>
                  <CardDescription>
                    Confirmed provider events — the only source of Delivered, Delayed and Bounced.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!status.requiredKeys.find(k => k.key === 'EMAIL_WEBHOOK_SECRET')?.set && (
                    <div className="rounded-lg bg-amber-500/10 p-3 text-[12px] leading-relaxed text-amber-600 dark:text-amber-300">
                      <b>EMAIL_WEBHOOK_SECRET is missing.</b> Deliveries can never be confirmed, so nothing
                      will ever show as Delivered. Create a webhook endpoint in your provider dashboard
                      pointing at <span className="font-mono">/api/webhooks/email</span> and set the
                      matching secret in Settings → Environment.
                    </div>
                  )}
                  {webhookEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No webhook events received yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {webhookEvents.map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <span className="truncate font-semibold">{e.type}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {e.status ?? ''}
                            {e.address ? ` · ${e.address}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email templates ({status.templates.length})</CardTitle>
                <CardDescription>
                  Every transactional email the platform can send. Adding a template is a code change;
                  wiring new ones needs no UI work.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {status.templates.map((tpl) => (
                    <div key={tpl.key} className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{tpl.subject}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{tpl.key}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 uppercase">
                        {tpl.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Password reset links are generated in <span className="font-mono">/api/auth/forgot-password</span>,
              expire after 60 minutes, work once, and are invalidated when a new one is requested.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}