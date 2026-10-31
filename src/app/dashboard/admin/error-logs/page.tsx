'use client';

/**
 * ERROR CENTER (`/dashboard/admin/error-logs`).
 *
 * The section admins land on when something breaks: every runtime error the
 * app captured (GlobalErrorListener → DeferredErrorLogger → /api/error-log →
 * Firestore `errorLogs`), newest first, with the full stack/context behind a
 * click and — the point of this page — a **Copy report** button that puts a
 * paste-ready text digest on the clipboard for the assistant session.
 *
 * `?filter=report-<docId>` (the link /api/error-log hands back with each
 * queued batch) focuses a single report; the param is read from
 * `window.location.search` after mount so no Suspense boundary is needed.
 *
 * This route used to be a removed-placeholder stub even though the error-log
 * API linked admins straight to it — every captured error ended at a dead
 * end. Data access and copy formatting live in `@/lib/admin/error-report`
 * (unit-tested); this file is the shell.
 */
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ErrorLog } from '@/lib/types';
import { buildErrorReport } from '@/lib/admin/error-report';
import { Check, ChevronDown, ClipboardCopy, Eye, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-red-500/10 text-red-400 border-red-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  ignored: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
};

/** Firestore Timestamp / ISO string / anything else → a readable time. */
function formatTime(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  const maybe = value as { toDate?: () => Date } | null | undefined;
  if (maybe && typeof maybe.toDate === 'function') {
    try {
      return maybe.toDate().toISOString().slice(0, 19).replace('T', ' ');
    } catch {
      /* fall through */
    }
  }
  return '—';
}

export default function ErrorCenterPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const errorQuery = useMemo(
    () => query(collection(firestore, 'errorLogs'), orderBy('timestamp', 'desc'), limit(200)),
    [firestore],
  );
  const { data: logs, isLoading } = useCollection<ErrorLog>(errorQuery);

  // The /api/error-log notification links here with `?filter=report-<id>`.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('filter');
    if (value && value.startsWith('report-')) setFilter(value.slice('report-'.length));
  }, []);

  const all = logs ?? [];
  const visible = filter ? all.filter((log) => log.id === filter) : all;
  const unresolved = all.filter((log) => (log.status ?? 'new') === 'new').length;
  const report = useMemo(() => buildErrorReport(visible), [visible]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${what} copied`,
        description: 'Paste it into your assistant chat to get it fixed.',
      });
    } catch {
      // Clipboard blocked (permissions/insecure context): show the text so it
      // can be selected manually instead of losing the report.
      setShowReport(true);
      toast({
        variant: 'destructive',
        title: 'Clipboard unavailable',
        description: 'The report is shown below — select and copy it manually.',
      });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter">
                  Error Center
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Every runtime error the app captured, newest first. Open a row for the stack
                  and context, then use <strong>Copy report</strong> and paste the text into
                  your assistant chat to get it resolved.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-red-400">
                  {unresolved} unresolved
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {all.length} loaded
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => void copy(report, 'Report')} disabled={!visible.length}>
                <ClipboardCopy className="mr-2 h-4 w-4" /> Copy report
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReport((v) => !v)}>
                <Eye className="mr-2 h-4 w-4" /> {showReport ? 'Hide report' : 'View report'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {filter && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
                <span>
                  Showing report <code className="font-mono text-xs">{filter}</code> only.
                </span>
                <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
                  Show all errors
                </Button>
              </div>
            )}

            {showReport && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/60 p-4 text-xs leading-relaxed text-neutral-200">
                {report}
              </pre>
            )}

            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading errors…</p>
            ) : visible.length === 0 ? (
              <div className="py-10 text-center">
                <Check className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
                <p className="font-bold">{filter ? 'Report not found.' : 'No errors captured.'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter
                    ? 'It may be older than the newest 200 entries.'
                    : 'Runtime errors appear here automatically — nothing is broken right now.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
                {visible.map((log) => {
                  const id = log.id ?? `${log.timestamp}-${log.errorMessage ?? log.message}`;
                  const isOpen = expanded === id;
                  const message = log.errorMessage ?? log.message ?? 'Unknown Error';
                  const status = log.status ?? 'new';
                  const stack = log.errorStack ?? log.stack;
                  const context =
                    log.context && typeof log.context === 'object'
                      ? JSON.stringify(log.context, null, 2)
                      : null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <ChevronDown
                          className={cn(
                            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            isOpen && 'rotate-180',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-red-400">
                            {message}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {formatTime(log.timestamp)}
                            {log.userId ? ` · user ${log.userId}` : ''}
                            {log.environment ? ` · ${log.environment}` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                            STATUS_STYLES[status] ?? STATUS_STYLES.new,
                          )}
                        >
                          {status}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 border-t border-white/5 bg-black/40 px-4 py-3">
                          {stack ? (
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/60 p-3 text-xs leading-relaxed text-neutral-300">
                              {stack}
                            </pre>
                          ) : (
                            <p className="text-xs text-muted-foreground">No stack captured.</p>
                          )}
                          {context && (
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Context
                              </p>
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/60 p-3 text-xs text-neutral-300">
                                {context}
                              </pre>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void copy(buildErrorReport([log], { maxEntries: 1 }), 'Error')
                              }
                            >
                              <ClipboardCopy className="mr-2 h-3.5 w-3.5" /> Copy this error
                            </Button>
                            {log.userId && (
                              <Button size="sm" variant="ghost" onClick={() => setExpanded(null)}>
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Collapse
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
