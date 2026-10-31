'use client';

/**
 * /dashboard/admin/requests — Buyer Request Management (spec §6).
 *
 * Read-only analytics + audited moderation. Every figure here is derived from
 * bounded scans in `/api/admin/requests`, and every moderation press writes an
 * `activityLogs` entry (category REQUEST_ENGINE) with actor, target and reason.
 * Nothing in this screen can manufacture demand: queues only ever list
 * requests and offers that real users posted.
 */

import { useCallback, useEffect, useState } from 'react';

interface Stats {
  total: number;
  open: number;
  openNoOffers: number;
  openWithOffers: number;
  expired: number;
  closed: number;
  deleted: number;
  reported: number;
  categories: Array<{ category: string; count: number }>;
  locations: Array<{ location: string; count: number }>;
  offers: { total: number; submitted: number; accepted: number; declined: number; draft: number };
  conversion: { acceptedOffers: number; submittedBase: number; rate: number | null };
  timeToFirstOffer: { samples: number; covered: number; averageHours: number | null };
  reports: Array<{
    kind: 'request' | 'offer';
    id: string;
    targetId: string;
    title: string;
    reports: number;
    reason: string;
    at: string;
  }>;
  recentAudit: Array<{ action: string; targetId: string; actorUid: string; detail: string; at: string }>;
}

interface QueueRow {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  location: string;
  offers: number;
  reports: number;
  status: string;
  expired: boolean;
  expiresAt: string | null;
  createdAt: number;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'red' | 'muted' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === 'red' ? 'text-red-500' : tone === 'muted' ? 'text-neutral-400' : 'text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Bars({ items, accent = 'bg-red-500' }: { items: Array<{ label: string; count: number }>; accent?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">No open demand recorded yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-neutral-300">{item.label}</span>
            <span className="tabular-nums text-neutral-500">{item.count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/5">
            <div
              className={`h-1.5 rounded-full ${accent}`}
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function BuyerRequestAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/requests', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as { stats: Stats; queue: QueueRow[] };
      setStats(data.stats);
      setQueue(data.queue);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (target: 'request' | 'offer', id: string, action: string) => {
      let reason = '';
      if (action === 'delete') {
        reason = window.prompt('Reason for deleting this content (recorded in the audit log):') ?? '';
        if (reason.trim().length < 5) return;
      }
      setBusyId(`${target}:${id}`);
      try {
        const res = await fetch('/api/admin/requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, id, action, reason }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Action failed (${res.status})`);
        }
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-72 animate-pulse rounded bg-white/5" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-bold text-white">Buyer Request Management</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Demand analytics, spam reports and audited moderation across the customer request marketplace.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total requests" value={stats.total} />
            <Stat label="Open requests" value={stats.open} />
            <Stat label="Open · no offers" value={stats.openNoOffers} tone="red" />
            <Stat label="Open · with offers" value={stats.openWithOffers} />
            <Stat label="Expired" value={stats.expired} tone="muted" />
            <Stat label="Closed / fulfilled" value={stats.closed} tone="muted" />
            <Stat label="Requests reported" value={stats.reported} tone="red" />
            <Stat label="Offers accepted" value={stats.offers.accepted} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Popular categories
              </h2>
              <Bars items={stats.categories.map((c) => ({ label: c.category, count: c.count }))} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Demand by location
              </h2>
              <Bars items={stats.locations.map((l) => ({ label: l.location, count: l.count }))} />
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">Time to first offer</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {stats.timeToFirstOffer.averageHours === null ? '—' : `${stats.timeToFirstOffer.averageHours}h`}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {stats.timeToFirstOffer.averageHours === null
                    ? 'No offers recorded yet.'
                    : `Average across ${stats.timeToFirstOffer.samples} of ${stats.timeToFirstOffer.covered} scanned requests (requests created before this field existed are excluded).`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">Offer → order conversion</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {stats.conversion.rate === null ? '—' : `${stats.conversion.rate}%`}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {stats.conversion.acceptedOffers} accepted of {stats.conversion.submittedBase} decided offers.
                  {stats.offers.draft > 0 && ` ${stats.offers.draft} drafts excluded (never sent).`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">Offers by status</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-white/5 px-2 py-1 text-neutral-300">submitted {stats.offers.submitted}</span>
                  <span className="rounded bg-red-500/15 px-2 py-1 text-red-400">accepted {stats.offers.accepted}</span>
                  <span className="rounded bg-white/5 px-2 py-1 text-neutral-400">declined {stats.offers.declined}</span>
                  <span className="rounded bg-white/5 px-2 py-1 text-neutral-500">draft {stats.offers.draft}</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Open request queue</h2>
          <span className="text-xs text-neutral-500">{queue.length} newest</span>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-neutral-500">No open requests right now.</p>
        ) : (
          <div className="space-y-2">
            {queue.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/30 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-red-400">{row.requestNumber}</span>
                    {row.expired && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase text-red-400">
                        expired
                      </span>
                    )}
                    {row.reports > 0 && (
                      <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-400">
                        {row.reports} report{row.reports > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-white">{row.title}</div>
                  <div className="text-xs text-neutral-500">
                    {row.category}
                    {row.location ? ` · ${row.location}` : ''} · {row.offers} offer{row.offers === 1 ? '' : 's'}
                    {row.expiresAt ? ` · expires ${row.expiresAt.slice(0, 10)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/requests/${row.id}`}
                    className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
                  >
                    View
                  </a>
                  <button
                    onClick={() => void act('request', row.id, row.status === 'closed' ? 'reopen' : 'close')}
                    disabled={busyId === `request:${row.id}`}
                    className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    {row.status === 'closed' ? 'Reopen' : 'Close'}
                  </button>
                  <button
                    onClick={() => void act('request', row.id, 'delete')}
                    disabled={busyId === `request:${row.id}`}
                    className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Spam reports</h2>
          <span className="text-xs text-neutral-500">{stats?.reports.length ?? 0} queued</span>
        </div>
        {!stats || stats.reports.length === 0 ? (
          <p className="text-sm text-neutral-500">No reports waiting for review.</p>
        ) : (
          <div className="space-y-2">
            {stats.reports.map((rep) => (
              <div
                key={`${rep.kind}:${rep.id}`}
                className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/30 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-yellow-400">
                    {rep.kind} · {rep.reports} report{rep.reports > 1 ? 's' : ''}
                  </div>
                  <div className="truncate text-sm text-white">{rep.title}</div>
                  <div className="text-xs text-neutral-500">
                    {rep.reason && `“${rep.reason}”`}
                    {rep.at ? ` — ${rep.at.slice(0, 10)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={rep.kind === 'request' ? `/requests/${rep.targetId}` : `/requests/${rep.targetId}`}
                    className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
                  >
                    View
                  </a>
                  <button
                    onClick={() => void act(rep.kind, rep.id, 'dismiss_reports')}
                    disabled={busyId === `${rep.kind}:${rep.id}`}
                    className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() =>
                      void act(rep.kind, rep.id, rep.kind === 'request' ? 'delete' : 'decline')
                    }
                    disabled={busyId === `${rep.kind}:${rep.id}`}
                    className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {rep.kind === 'request' ? 'Delete request' : 'Remove offer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Moderation audit log
        </h2>
        {!stats || stats.recentAudit.length === 0 ? (
          <p className="text-sm text-neutral-500">No administrative actions recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {stats.recentAudit.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="flex flex-wrap items-baseline gap-2 text-neutral-400">
                <span className="tabular-nums text-neutral-500">{entry.at.slice(0, 16).replace('T', ' ')}</span>
                <span className="font-medium text-neutral-200">{entry.action}</span>
                <span className="font-mono text-neutral-500">{entry.targetId.slice(0, 12)}</span>
                {entry.detail && <span className="text-neutral-500">— {entry.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
