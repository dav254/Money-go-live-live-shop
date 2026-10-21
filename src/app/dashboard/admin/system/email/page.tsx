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

export default function AdminEmailSettingsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [recipient, setRecipient] = React.useState('');
  const [sending, setSending] = React.useState(false);

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