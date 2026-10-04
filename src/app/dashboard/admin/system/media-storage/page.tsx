'use client';

import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Trash2, RefreshCw, Image, Video, AlertTriangle, CheckCircle2, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  mediaBytes: number;
  tmpBytes: number;
  mediaCount: number;
  tmpCount: number;
  mode: 'NORMAL' | 'STORAGE_PROTECTION';
  threshold: string | null;
  reserveBytes: number;
}

interface StoragePayload {
  storage: StorageStats;
  media: { images: number; videos: number; thumbnails: number; failed: number; mediaBytes: number };
  largestFiles: Array<{ id: string; name: string; type: string; sizeBytes: number; url: string; createdAt: string | null }>;
  mediaPath: string;
  tmpPath: string;
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const THRESHOLD_STYLES: Record<string, { className: string; label: string }> = {
  WARNING: { className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', label: 'Warning (70%+)' },
  HIGH: { className: 'bg-orange-500/10 text-orange-500 border-orange-500/30', label: 'High (80%+)' },
  CRITICAL: { className: 'bg-red-500/10 text-red-500 border-red-500/30', label: 'Critical (90%+) — uploads restricted' },
  EMERGENCY: { className: 'bg-red-600/10 text-red-600 border-red-600/40', label: 'Emergency (95%+) — uploads disabled' },
};

export default function AdminMediaStoragePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<StoragePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/media/storage', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load');
      setData(await res.json());
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const runCleanup = async () => {
    if (!user) return;
    setCleaning(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/media/cleanup', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Cleanup failed');
      toast({
        title: 'Cleanup complete',
        description: `Removed ${body.removedTemp} temp + ${body.removedOrphans} orphaned files • reclaimed ${fmtBytes(body.reclaimedBytes)}`,
      });
      await load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cleanup failed', description: e.message });
    } finally {
      setCleaning(false);
    }
  };

  const s = data?.storage;
  const meterColor = !s
    ? 'bg-primary'
    : s.usedPercent >= 90
      ? 'bg-red-600'
      : s.usedPercent >= 80
        ? 'bg-orange-500'
        : s.usedPercent >= 70
          ? 'bg-yellow-500'
          : 'bg-green-500';

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <HardDrive className="h-6 w-6 text-primary" /> Media Storage
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            VPS disk monitor & cleanup control
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runCleanup} disabled={cleaning}>
            <Trash2 className="mr-2 h-4 w-4" /> {cleaning ? 'Cleaning…' : 'Run Cleanup Now'}
          </Button>
        </div>
      </div>

      {s && s.mode === 'STORAGE_PROTECTION' && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black uppercase text-sm text-red-500">
                Storage Protection Active ({s.threshold})
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                New large uploads are restricted and cleanup runs every 10 minutes. Existing published media is never deleted automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">VPS Disk</CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-widest">
              {data?.mediaPath ? `Media root: ${data.mediaPath}` : ' '}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black">{s ? `${s.usedPercent.toFixed(1)}%` : '—'}</p>
              <p className="text-xs font-bold text-muted-foreground">
                {s ? `${fmtBytes(s.usedBytes)} used of ${fmtBytes(s.totalBytes)}` : ''}
              </p>
            </div>
            <Progress value={s?.usedPercent ?? 0} className={`h-3 [&>div]:${meterColor}`} />
            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-muted-foreground uppercase text-[9px] tracking-widest">Free</p>
                <p className="text-base">{s ? fmtBytes(s.freeBytes) : '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-muted-foreground uppercase text-[9px] tracking-widest">Safety Reserve</p>
                <p className="text-base">{s ? fmtBytes(s.reserveBytes) : '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-muted-foreground uppercase text-[9px] tracking-widest">Media Files</p>
                <p className="text-base">{s ? fmtBytes(s.mediaBytes) : '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-muted-foreground uppercase text-[9px] tracking-widest">Temporary</p>
                <p className="text-base">{s ? `${fmtBytes(s.tmpBytes)} • ${s.tmpCount} files` : '—'}</p>
              </div>
            </div>
            {s?.threshold && (
              <Badge variant="outline" className={THRESHOLD_STYLES[s.threshold]?.className}>
                {THRESHOLD_STYLES[s.threshold]?.label ?? s.threshold}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Media Library</CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-widest">
              Optimized files + thumbnails only — originals are never kept
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Image, label: 'Images', value: data?.media.images },
                { icon: Video, label: 'Videos', value: data?.media.videos },
                { icon: Image, label: 'Thumbnails', value: data?.media.thumbnails },
                { icon: FileWarning, label: 'Failed uploads', value: data?.media.failed },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-muted/40 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="text-base font-black">{value ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
            {data && data.media.failed > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Failed temp files are removed automatically after the retention window (or by cleanup).
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest">Largest Files</CardTitle>
          <CardDescription className="text-[10px] uppercase tracking-widest">
            Top 10 by size — inspect before manual removal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.largestFiles.length ? (
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-6 text-center">
              No media files yet
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.largestFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" className="h-10 w-10 rounded-lg object-cover bg-muted" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{f.name}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {f.type} • {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-black shrink-0">{fmtBytes(f.sizeBytes)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
