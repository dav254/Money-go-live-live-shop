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
  Eye,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  Share2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

interface Channel {
  id: string;
  provider: string;
  name: string;
  profile?: string;
  disabled: boolean;
}

interface AttemptRow {
  at: string;
  status: string;
  productId: string;
  productName: string;
  channels: number;
  postCount: number;
  errorClass?: string;
}

interface StatusResponse {
  configured: boolean;
  reachable: boolean;
  authOk: boolean;
  errorClass?: string;
  hint?: string;
  channels: Channel[];
  recent: AttemptRow[];
}

interface PreviewResponse {
  exists: boolean;
  name?: string;
  price?: number | null;
  currency?: string;
  eligible?: boolean;
  reason?: string;
  shareUrl?: string;
  preview?: string | null;
}

interface PublishResponse {
  ok: boolean;
  status: 'accepted' | 'scheduled' | 'failed';
  postIds?: string[];
  message?: string;
  errorClass?: string;
  reason?: string;
}

const OUTCOME_STYLES: Record<string, string> = {
  accepted: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-600 dark:text-cyan-300',
  scheduled: 'border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-500',
};

export default function AdminPostizPage() {
  const { toast } = useToast();
  const { user } = useUser();

  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [productId, setProductId] = React.useState('');
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = React.useState(false);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [note, setNote] = React.useState('');
  const [scheduleAt, setScheduleAt] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<PublishResponse | null>(null);

  const authHeaders = React.useCallback(async () => {
    const token = await user!.getIdToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [user]);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/postiz/status', { headers: await authHeaders() });
      const data = (await res.json()) as StatusResponse;
      if (res.ok) setStatus(data);
      else
        setStatus({
          configured: false,
          reachable: false,
          authOk: false,
          errorClass: 'auth',
          channels: [],
          recent: [],
        });
    } catch {
      setStatus({
        configured: false,
        reachable: false,
        authOk: false,
        errorClass: 'transient',
        channels: [],
        recent: [],
      });
    } finally {
      setLoading(false);
    }
  }, [user, authHeaders]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runPreview = async () => {
    if (!user || !productId.trim()) return;
    setPreviewing(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/postiz/publish?productId=${encodeURIComponent(productId.trim())}`,
        { headers: await authHeaders() },
      );
      setPreview((await res.json()) as PreviewResponse);
    } catch {
      setPreview({ exists: false });
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    if (!user || !preview?.eligible) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/postiz/publish', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          productId: productId.trim(),
          channelIds: selected,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(scheduleAt ? { scheduleAt: new Date(scheduleAt).toISOString() } : {}),
        }),
      });
      const data = (await res.json()) as PublishResponse;
      setResult(data);
      if (data.ok) {
        toast({
          title: data.status === 'scheduled' ? 'Scheduled in Postiz' : 'Draft saved in Postiz',
          description: data.message,
        });
        void load();
      } else {
        toast({
          title: 'Not accepted',
          description: data.message ?? 'Postiz rejected the request.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Request failed', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChannel = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const healthy = status?.configured && status.reachable && status.authOk;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Postiz — social marketing</h1>
            <p className="text-sm text-muted-foreground">
              Stage drafts and scheduled posts on social.vidnov.com. Publishing publicly always
              happens in Postiz itself — never from this page.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* ── Health ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4" /> Instance health
            </CardTitle>
            <CardDescription>Configuration and API key validity, checked server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !status ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking…
              </div>
            ) : !status?.configured ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">Not configured on the server.</p>
                  <p className="text-muted-foreground">
                    Set <code>POSTIZ_API_URL</code> and <code>POSTIZ_API_KEY</code> (server-only env,
                    never NEXT_PUBLIC). See <code>ops/postiz/README.md</code>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-400/40 text-emerald-600">
                  configured
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    status.reachable
                      ? 'border-emerald-400/40 text-emerald-600'
                      : 'border-red-500/40 text-red-500'
                  }
                >
                  {status.reachable ? 'instance reachable' : 'unreachable'}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    status.authOk
                      ? 'border-emerald-400/40 text-emerald-600'
                      : 'border-red-500/40 text-red-500'
                  }
                >
                  {status.authOk ? 'API key accepted' : `API key: ${status.errorClass ?? 'invalid'}`}
                </Badge>
                <Badge variant="outline">
                  {status.channels.length} channel{status.channels.length === 1 ? '' : 's'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Channels ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Connected channels
            </CardTitle>
            <CardDescription>
              Managed in Postiz (Integrations). This list is read-only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(status?.channels.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels connected yet — open{' '}
                <a
                  className="underline underline-offset-2"
                  href="https://social.vidnov.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  social.vidnov.com
                </a>{' '}
                and add your first integration (Bluesky/Mastodon/Telegram need no developer app).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status!.channels.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className={c.disabled ? 'opacity-50' : 'border-white/20'}
                  >
                    {c.provider}
                    {c.name ? ` · ${c.name}` : ''}
                    {c.disabled ? ' (disabled)' : ''}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Compose ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Stage a campaign post
            </CardTitle>
            <CardDescription>
              Reads the genuine saved listing; missing-price or unavailable listings are refused.
              Creates a <strong>draft</strong> (or a schedule) — never publishes immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="postiz-product">Product ID</Label>
              <div className="flex gap-2">
                <Input
                  id="postiz-product"
                  placeholder="Firestore product document id"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setPreview(null);
                    setResult(null);
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => void runPreview()}
                  disabled={previewing || !productId.trim()}
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="ml-2">Check</span>
                </Button>
              </div>
            </div>

            {preview && !preview.exists && (
              <p className="text-sm text-red-500">No listing with that id.</p>
            )}
            {preview?.exists && preview.eligible === false && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
                Refused: {preview.reason === 'missing_price' ? 'this listing has no valid price' : preview.reason === 'unavailable' ? 'this listing is unavailable' : 'this listing has no name'}.
              </div>
            )}
            {preview?.eligible && (
              <div className="space-y-3 rounded-md border border-white/10 bg-white/5 p-3">
                <div className="text-sm">
                  <span className="font-medium">{preview.name}</span>
                  {typeof preview.price === 'number' && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {preview.price} {preview.currency}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-xs text-muted-foreground">
                  {preview.preview}
                </pre>
                <div className="grid gap-2">
                  <Label>Channels</Label>
                  {(status?.channels.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Connect a channel in Postiz first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {status!.channels
                        .filter((c) => !c.disabled)
                        .map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(c.id)}
                              onChange={() => toggleChannel(c.id)}
                            />
                            {c.provider} · {c.name}
                          </label>
                        ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postiz-note">Marketing note (optional, human copy)</Label>
                  <Input
                    id="postiz-note"
                    placeholder="New drop just landed —"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postiz-when">Schedule (empty = draft)</Label>
                  <Input
                    id="postiz-when"
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </div>
                <Button onClick={() => void submit()} disabled={submitting || selected.length === 0}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">
                    {scheduleAt ? 'Schedule in Postiz' : 'Save draft in Postiz'}
                  </span>
                </Button>
              </div>
            )}

            {result && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  result.ok ? 'border-white/10 bg-white/5' : 'border-red-500/40 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <Badge variant="outline" className={OUTCOME_STYLES[result.status]}>
                    {result.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {result.ok
                      ? `${result.postIds?.length ?? 0} post record(s)`
                      : (result.errorClass ?? result.reason ?? '')}
                  </span>
                </div>
                {result.message && <p className="mt-2 text-muted-foreground">{result.message}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent attempts ────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Recent attempts</CardTitle>
            <CardDescription>
              Last 15 staged posts. &quot;Published&quot; never appears here — only Postiz or a
              provider webhook can ever confirm a live post.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(status?.recent.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing staged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">When</th>
                      <th className="py-2 pr-4 font-medium">Listing</th>
                      <th className="py-2 pr-4 font-medium">Channels</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status!.recent.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">{r.at || '—'}</td>
                        <td className="max-w-[240px] truncate py-2 pr-4">
                          {r.productName || r.productId}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{r.channels}</td>
                        <td className="py-2">
                          <Badge variant="outline" className={OUTCOME_STYLES[r.status] ?? ''}>
                            {r.status}
                          </Badge>
                          {r.errorClass && (
                            <span className="ml-2 text-xs text-muted-foreground">{r.errorClass}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!healthy && status?.configured && (
              <p className="mt-3 text-xs text-amber-500">
                Instance is not fully healthy — new attempts will fail honestly until it recovers.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
