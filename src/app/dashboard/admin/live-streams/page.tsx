'use client';

/**
 * Admin — VIDNOV LIVE management (spec §41, §42).
 *
 * Tabs: All Streams · Active · Reported. Admins can inspect stats and stop
 * any live (owner-level DELETE works for admins by design). LIVEKIT_API_SECRET
 * and other infrastructure stay server-side; this page only touches Vidnov APIs.
 */

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Eye, Flag, Loader2, Radio, StopCircle } from 'lucide-react';

interface AdminLiveCard {
  id: string;
  title: string;
  status: string;
  sellerId?: string;
  reportsCount?: number;
  visibility?: string;
  viewerCount: number;
}

type Tab = 'all' | 'active' | 'reported';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'All Streams' },
  { key: 'active', label: 'Active' },
  { key: 'reported', label: 'Reported' },
];

export default function AdminLiveStreamsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>('all');
  const [streams, setStreams] = React.useState<AdminLiveCard[] | null>(null);
  const [stopping, setStopping] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    const token = await (user as any).getIdToken();
    const res = await fetch(`/api/live?scope=${tab === 'all' ? 'all' : tab}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setStreams(res.ok ? (await res.json()).streams ?? [] : []);
  }, [user, tab]);

  React.useEffect(() => {
    setStreams(null);
    void load();
  }, [load]);

  const stopLive = async (id: string) => {
    setStopping(id);
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch(`/api/live/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Live stopped', description: 'The stream was ended by moderation.' });
      await load();
    } catch {
      toast({ variant: 'destructive', title: 'Could not stop the live.' });
    } finally {
      setStopping(null);
    }
  };

  const activeCount = (streams ?? []).filter((s) => s.status === 'LIVE' || s.status === 'STARTING').length;
  const reportedCount = (streams ?? []).filter((s) => (s.reportsCount ?? 0) > 0).length;

  return (
    <AdminLayout>
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8 vn-page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
            <Radio className="h-3.5 w-3.5" /> ADMIN
          </p>
          <h1 className="font-grotesk text-3xl font-bold text-foreground">LIVE STREAMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor, review reports and stop lives that break the rules.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-red-500/50 text-red-500">
            {activeCount} live now
          </Badge>
          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
            {reportedCount} reported
          </Badge>
        </div>
      </header>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest vn-transition',
              tab === t.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {streams === null ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : streams.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No streams in this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stream</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Viewers</TableHead>
                <TableHead>Reports</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/live/${s.id}`} className="font-medium text-foreground hover:text-primary">
                      {s.title}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.sellerId?.slice(0, 10) ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] font-black uppercase',
                        s.status === 'LIVE' && 'border-red-500/50 text-red-500',
                        s.status === 'ENDED' && 'text-muted-foreground',
                      )}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.viewerCount}</TableCell>
                  <TableCell>
                    {(s.reportsCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <Flag className="h-3 w-3" /> {s.reportsCount}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-[10px] uppercase tracking-widest">
                        <Link href={`/live/${s.id}`}>
                          <Eye className="mr-1 h-3 w-3" /> View
                        </Link>
                      </Button>
                      {(s.status === 'LIVE' || s.status === 'STARTING') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 rounded-lg text-[10px] uppercase tracking-widest"
                          onClick={() => stopLive(s.id)}
                          disabled={stopping === s.id}
                        >
                          {stopping === s.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <StopCircle className="mr-1 h-3 w-3" />}
                          Stop
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
