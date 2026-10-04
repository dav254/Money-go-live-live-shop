'use client';

import * as React from 'react';
import {
  Mail, Inbox, FileText, Settings2, ScrollText, Loader2, RefreshCw,
  ShieldAlert, FlaskConical, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useUser } from '@/firebase';

interface EmailLog {
  id: string;
  to: string;
  from: string;
  subject: string;
  template: string;
  category: string;
  status: string;
  provider: string;
  providerId?: string | null;
  failureReason?: string | null;
  createdAt: string | null;
  devMode: boolean;
}

interface DevMail {
  id: string;
  to: string;
  from: string;
  subject: string;
  templateKey: string;
  category: string;
  capturedAt: string | null;
  text: string;
}

interface TemplateDef {
  key: string;
  subject: string;
  category: string;
  vars: string[];
}

interface EngineConfig {
  appUrl: string;
  emailMode: string;
  emailProvider: string;
  emailFrom: string;
  addresses: Record<string, string>;
}

const STATUS_STYLES: Record<string, string> = {
  QUEUED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  SENDING: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  SENT: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  DELIVERED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  BOUNCED: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

async function adminFetch(path: string) {
  // The Firebase user object exposes getIdToken in the client SDK. Resolve it
  // from the active surface so this never reads the other UI's session.
  const { getSurfaceAuth } = await import('@/firebase/surface-auth');
  const current = getSurfaceAuth().currentUser;
  if (!current) throw new Error('Not signed in');
  const idToken = await current.getIdToken();
  const res = await fetch(path, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function AdminCommunicationPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [mails, setMails] = React.useState<DevMail[]>([]);
  const [templates, setTemplates] = React.useState<TemplateDef[]>([]);
  const [config, setConfig] = React.useState<EngineConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selectedMail, setSelectedMail] = React.useState<DevMail | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, devData, tplData] = await Promise.all([
        adminFetch('/api/admin/communication?box=email-logs&limit=100'),
        adminFetch('/api/admin/communication?box=dev-mailbox&limit=50'),
        adminFetch('/api/admin/communication?box=templates'),
      ]);
      setLogs(logsData.logs ?? []);
      setMails(devData.messages ?? []);
      setTemplates(tplData.templates ?? []);
      setConfig(tplData.config ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load communication data.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) load();
  }, [user, load]);

  const filteredLogs = statusFilter === 'all' ? logs : logs.filter(l => l.status === statusFilter);

  return (
    <div className="space-y-6 vn-page-enter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary mb-1">Administration</p>
          <h1 className="font-grotesk text-3xl font-bold tracking-tight">Communication Center</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            One engine behind every Vidnov message — email delivery, in-app notifications and templates.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl font-semibold">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Engine status strip */}
      {config && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Mode', value: config.emailMode, icon: FlaskConical, accent: config.emailMode === 'production' ? 'text-emerald-500' : 'text-amber-500' },
            { label: 'Provider', value: config.emailProvider, icon: Send, accent: '' },
            { label: 'From', value: config.emailFrom, icon: Mail, accent: '' },
            { label: 'Base URL', value: config.appUrl.replace(/^https?:\/\//, ''), icon: GlobeIcon, accent: '' },
          ].map(s => (
            <Card key={s.label} className="rounded-xl border-border">
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                </p>
                <p className={cn('mt-1.5 truncate text-[13px] font-semibold', s.accent)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-red-600 dark:text-red-400">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="email-logs">
        <TabsList className="rounded-xl">
          <TabsTrigger value="email-logs" className="rounded-lg"><ScrollText className="mr-2 h-4 w-4" /> Email Logs</TabsTrigger>
          <TabsTrigger value="dev-mailbox" className="rounded-lg"><Inbox className="mr-2 h-4 w-4" /> Dev Mailbox</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-lg"><FileText className="mr-2 h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg"><Settings2 className="mr-2 h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        {/* ---------- EMAIL LOGS ---------- */}
        <TabsContent value="email-logs" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'SENT', 'FAILED', 'BOUNCED', 'QUEUED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest vn-transition',
                  statusFilter === s ? 'vn-grad-coral text-white' : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <Card className="rounded-2xl border-border overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-5">{[1, 2, 3, 4, 5].map(n => <Skeleton key={n} className="h-12 w-full rounded-lg" />)}</div>
              ) : filteredLogs.length === 0 ? (
                <p className="py-14 text-center text-sm text-muted-foreground">
                  No email activity yet. Send a test from the forgot-password flow, or sign up a new account.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredLogs.map(l => (
                    <div key={l.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-4">
                      <Badge className={cn('w-fit rounded-md border-0 text-[10px] font-bold', STATUS_STYLES[l.status] ?? '')}>
                        {l.status}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{l.subject}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          to {l.to} · from {l.from}
                          {l.failureReason && <span className="text-destructive"> · {l.failureReason}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:shrink-0">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{l.template}</span>
                        {l.devMode && <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-500">DEV</span>}
                        <span className="text-[11px] text-muted-foreground">{l.createdAt ? format(new Date(l.createdAt), 'MMM d, HH:mm') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- DEV MAILBOX ---------- */}
        <TabsContent value="dev-mailbox">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
            <Card className="rounded-2xl border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4 text-amber-500" /> Captured in dev mode</CardTitle>
                <CardDescription className="text-[12px]">EMAIL_MODE=development — nothing leaves the building.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {mails.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No captured mail yet.</p>
                ) : (
                  <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                    {mails.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMail(m)}
                        className={cn('w-full p-4 text-left vn-transition hover:bg-muted/50', selectedMail?.id === m.id && 'bg-primary/5')}
                      >
                        <p className="truncate text-[13px] font-semibold">{m.subject}</p>
                        <p className="truncate text-[12px] text-muted-foreground">to {m.to}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {m.capturedAt ? format(new Date(m.capturedAt), 'MMM d, HH:mm') : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border">
              <CardContent className="p-6">
                {selectedMail ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-grotesk text-xl font-bold">{selectedMail.subject}</h3>
                      <p className="text-[12px] text-muted-foreground mt-1">
                        From {selectedMail.from} · to {selectedMail.to} · template <code className="rounded bg-muted px-1.5 py-0.5">{selectedMail.templateKey}</code>
                      </p>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-xl bg-muted/60 p-5 text-[13px] leading-relaxed font-sans">
                      {selectedMail.text}
                    </pre>
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                    <Inbox className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Select a captured message to preview it.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- TEMPLATES ---------- */}
        <TabsContent value="templates">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-sm">Template catalog — {templates.length} templates</CardTitle>
              <CardDescription className="text-[12px]">
                Safe <code className="rounded bg-muted px-1">{'{{var}}'}</code> substitution only — no executable content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {templates.map(t => (
                  <div key={t.key} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-primary">{t.key}</code>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.category}</span>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold leading-snug">{t.subject}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {t.vars.map(v => (
                        <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SETTINGS ---------- */}
        <TabsContent value="settings">
          {config && (
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle className="text-sm">Engine configuration (environment)</CardTitle>
                <CardDescription className="text-[12px]">
                  Change these in Settings → Environment — nothing is hard-coded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['APP_URL', config.appUrl],
                  ['EMAIL_MODE', config.emailMode],
                  ['EMAIL_PROVIDER', config.emailProvider || '(console — set provider + key to go live)'],
                  ['EMAIL_FROM', config.emailFrom],
                  ...Object.entries(config.addresses).map(([k, v]) => [`Mailbox: ${k}`, v]),
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 rounded-xl bg-muted/40 p-3.5">
                    <code className="text-[12px] font-mono font-semibold text-primary sm:w-44 shrink-0">{k}</code>
                    <span className="truncate text-[13px] text-muted-foreground">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
