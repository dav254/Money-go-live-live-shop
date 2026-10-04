'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type HealthState = 'operational' | 'degraded' | 'outage';

interface HealthSignal {
  id: string;
  label: string;
  state: HealthState;
  detail: string;
  href?: string;
}

interface PlatformHealth {
  state: HealthState;
  headline: string;
  alerts: string[];
  signals: HealthSignal[];
  checkedAt: string;
}

const STATE_STYLES: Record<HealthState, { dot: string; text: string; chip: string }> = {
  operational: {
    dot: 'bg-emerald-500',
    text: 'text-foreground',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
  degraded: {
    dot: 'bg-amber-500',
    text: 'text-foreground',
    chip: 'bg-amber-500/10 text-amber-600',
  },
  outage: {
    dot: 'bg-destructive',
    text: 'text-foreground',
    chip: 'bg-destructive/10 text-destructive',
  },
};

function StateIcon({ state }: { state: HealthState }) {
  if (state === 'outage') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (state === 'degraded') return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
}

/**
 * Platform health strip.
 *
 * This replaces the previously hardcoded "ALL SYSTEMS OPERATIONAL" badge,
 * which reported success unconditionally — it stayed green while the disk
 * filled up, AI jobs failed and disputes piled up. It now renders measured
 * state from /api/admin/platform-health, so the banner can only read
 * operational when every probed subsystem actually is.
 *
 * The banner colour follows the rolled-up state (worst signal wins) and each
 * tile links straight to the page where an admin fixes that subsystem.
 */
export function PlatformHealthStrip({ enabled }: { enabled: boolean }) {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/platform-health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setHealth((await res.json()) as PlatformHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load platform health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  // Never issue admin-gated requests before the role is confirmed.
  if (!enabled) return null;

  const state = health?.state ?? 'operational';
  const styles = STATE_STYLES[state];

  return (
    <section aria-label="Platform health" className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
        <h1 className="font-grotesk text-xl md:text-2xl font-semibold text-foreground tracking-wide">
          {isLoading ? 'CHECKING PLATFORM' : (health?.headline ?? 'HEALTH UNAVAILABLE')}
        </h1>
        <span className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]', styles.chip)}>
          {isLoading ? 'Checking' : state === 'operational' ? 'Live' : state}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            setIsLoading(true);
            load();
          }}
          aria-label="Refresh platform health"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      {health && health.alerts.length > 0 && (
        <ul className="space-y-1.5 border border-amber-500/25 bg-amber-500/5 p-4">
          {health.alerts.map((alert) => (
            <li key={alert} className="flex items-start gap-2 text-xs text-foreground/80">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              {alert}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card p-4">
                <Skeleton className="vn-skeleton h-3 w-16" />
                <Skeleton className="vn-skeleton mt-3 h-3 w-24" />
              </div>
            ))
          : (health?.signals ?? []).map((signal) => {
              const body = (
                <>
                  <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <StateIcon state={signal.state} />
                    {signal.label}
                  </p>
                  <p className="mt-2 flex items-center justify-between gap-2 text-xs text-foreground/80">
                    {signal.detail}
                    {signal.href && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </p>
                </>
              );
              return signal.href ? (
                <Link key={signal.id} href={signal.href} className="bg-card p-4 vn-transition hover:bg-secondary">
                  {body}
                </Link>
              ) : (
                <div key={signal.id} className="bg-card p-4">
                  {body}
                </div>
              );
            })}
      </div>

      {health && (
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Activity className="h-3 w-3" />
          Measured {new Date(health.checkedAt).toLocaleTimeString()}
        </p>
      )}
    </section>
  );
}