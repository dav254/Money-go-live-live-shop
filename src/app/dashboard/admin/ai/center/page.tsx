'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Activity, Coins, Cpu, Film, Image as ImageIcon, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

interface AiStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byEngine: Record<string, number>;
  pointsSpent: number;
  avgProcessingMs: number;
  failed: number;
  activeWorkers: number;
}

interface Pricing {
  points: number;
  dailyLimit?: number | null;
  maxDurationSeconds?: number;
}

interface AiSettingsShape {
  activeProviders: Record<string, string>;
  pricing: Record<string, Pricing>;
  refundOnFailure: boolean;
  freeTrialGenerations: number;
}

const CAPABILITIES = ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'image-animation'];

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | number; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`font-grotesk text-2xl font-black ${tone ?? ''}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ADMIN AI CENTER (spec §16).
 *
 * Generation jobs, queue health, models, points and limits in one place.
 * Provider secrets are never shown here — only which engine each capability
 * is routed to and what it costs.
 */
export default function AdminAiCenterPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [stats, setStats] = React.useState<AiStats | null>(null);
  const [settings, setSettings] = React.useState<AiSettingsShape | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/ai-stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = (await res.json()) as { stats: AiStats; settings: AiSettingsShape };
        setStats(data.stats);
        setSettings(data.settings);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const savePricing = async () => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: settings.pricing }),
      });
      if (!res.ok) throw new Error('Could not save pricing.');
      toast({ title: 'AI settings saved', description: 'New point costs apply to the next generation.' });
      void load();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">AI Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generation jobs, queue, models, points and limits for VIDNOV AI Studio.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading && !stats && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading AI statistics…
          </p>
        )}

        {stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Activity} label="Total generations" value={stats.total} />
              <StatCard
                icon={ImageIcon}
                label="Image generations"
                value={(stats.byType['text-to-image'] ?? 0) + (stats.byType['image-to-image'] ?? 0)}
              />
              <StatCard icon={Film} label="Video generations" value={(stats.total ?? 0) - (stats.byType['text-to-image'] ?? 0) - (stats.byType['image-to-image'] ?? 0)} />
              <StatCard icon={TriangleAlert} label="Failed jobs" value={stats.failed} tone="text-destructive" />
              <StatCard icon={Cpu} label="Jobs processing now" value={stats.activeWorkers} />
              <StatCard
                icon={Activity}
                label="Avg processing time"
                value={stats.avgProcessingMs ? `${Math.round(stats.avgProcessingMs / 1000)}s` : '—'}
              />
              <StatCard icon={Coins} label="Points spent" value={stats.pointsSpent.toLocaleString()} />
              <StatCard
                icon={Cpu}
                label="Active jobs"
                value={stats.byStatus.PROCESSING ?? 0}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Jobs by status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((status) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant="outline">{status}</Badge>
                      <span className="font-black">{stats.byStatus[status] ?? 0}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Jobs by engine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {Object.entries(stats.byEngine).length === 0 && (
                    <p className="text-muted-foreground">No generations recorded yet.</p>
                  )}
                  {Object.entries(stats.byEngine).map(([engine, count]) => (
                    <div key={engine} className="flex items-center justify-between">
                      <span className="font-semibold">{engine}</span>
                      <span className="font-black">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Points & limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Point costs are configurable here — the studio always reads these values, nothing is hard-coded
                in the UI.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {CAPABILITIES.map((capability) => {
                  const entry = settings.pricing[capability];
                  if (!entry) return null;
                  return (
                    <div key={capability} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold capitalize">{capability.replace(/-/g, ' ')}</p>
                        <Badge variant="secondary">{settings.activeProviders[capability] ?? '—'}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-xs text-muted-foreground">
                          Points
                          <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            defaultValue={entry.points}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                pricing: {
                                  ...settings.pricing,
                                  [capability]: { ...entry, points: Number(e.target.value) || 0 },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Daily limit
                          <Input
                            className="mt-1"
                            type="number"
                            min={0}
                            defaultValue={entry.dailyLimit ?? 0}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                pricing: {
                                  ...settings.pricing,
                                  [capability]: { ...entry, dailyLimit: Number(e.target.value) || null },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={savePricing} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save AI settings
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          GPU worker credentials and model API keys are never exposed to the browser — they live in server
          environment variables only.{' '}
          <Link href="/dashboard/admin/ai/video-generator" className="underline">
            Open the AI video studio
          </Link>
        </p>
      </div>
    </AdminLayout>
  );
}