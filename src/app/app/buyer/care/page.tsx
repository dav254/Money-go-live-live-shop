'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  FileQuestion,
  Headphones,
  Loader2,
  Search,
  Send,
} from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { createComplaint } from '@/app/actions/complaint-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · CUSTOMER CARE.
 *
 * The seller section has had a Customer Care screen since it shipped; the
 * buyer section only had a FAQ, so a buyer with a broken order or a seller to
 * report had nowhere inside the app to say so. This is that screen, and its
 * channel is deliberate: everything filed here goes through
 * `createComplaint` into the `complaints` collection — exactly what the admin
 * moderation console lists (Support & Moderation → Seller & Buyer Issues).
 * A message that lands anywhere else is a message nobody reads.
 *
 * "Your reports" needs its own API (`GET /api/complaints/mine`): the deployed
 * rules deny client `list` on `complaints` for everyone, so the buyer cannot
 * subscribe to their own rows. The route keys off the verified ID token, so a
 * buyer only ever sees their own reports.
 *
 * The FAQ below reads the same `helpArticles` collection the website reads,
 * filtered to `audience array-contains 'buyer'`.
 */

interface BuyerHelpArticle {
  id: string;
  question?: string;
  answer?: string;
  category?: string;
}

/** A report this buyer filed, as served by `/api/complaints/mine`. */
interface MyReport {
  id: string;
  reason?: string;
  description?: string;
  targetType?: string;
  status?: string;
  createdAt?: string | null;
}

const TOPICS = [
  { value: 'order', label: 'Order problem', typeLabel: 'Order' },
  { value: 'user', label: 'Report a seller or buyer', typeLabel: 'Seller or buyer' },
  { value: 'product', label: 'Report a listing', typeLabel: 'Listing' },
  { value: 'other', label: 'Something else', typeLabel: 'Something else' },
] as const;

type TopicValue = (typeof TOPICS)[number]['value'];

/** What each moderation status means to the person waiting on it. */
const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: 'Received', className: 'border-transparent bg-blue-500/15 text-blue-500 dark:text-blue-400' },
  investigating: { label: 'In review', className: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  resolved: { label: 'Resolved', className: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  dismissed: { label: 'Closed', className: 'border-transparent bg-white/10 text-muted-foreground' },
};

const typeLabelFor = (targetType?: string) =>
  TOPICS.find((t) => t.value === targetType || (targetType === 'system' && t.value === 'other'))?.typeLabel ??
  'Report';

const QUICK_ROUTES = [
  {
    label: 'My orders',
    hint: 'Track, dispute or ask for a refund',
    href: '/app/buyer/orders',
  },
  {
    label: 'Refund credit',
    hint: 'What you are owed and how to claim it',
    href: '/app/buyer/wallet',
  },
  {
    label: 'My requests',
    hint: 'Briefs you posted and seller offers',
    href: '/app/buyer/requests',
  },
  {
    label: 'Saved items',
    hint: 'Your wishlist',
    href: '/app/buyer/shop?view=saved',
  },
];

export default function BuyerSectionCare() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [term, setTerm] = React.useState('');

  // ── Contact form ──────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = React.useState(false);
  const [topic, setTopic] = React.useState<TopicValue>('order');
  const [subject, setSubject] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [orderId, setOrderId] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ── My reports ────────────────────────────────────────────────────────
  const [reports, setReports] = React.useState<MyReport[]>([]);
  const [reportsLoading, setReportsLoading] = React.useState(true);
  const [reportsError, setReportsError] = React.useState<string | null>(null);

  const loadReports = React.useCallback(async () => {
    if (!user) {
      setReports([]);
      setReportsError(null);
      setReportsLoading(false);
      return;
    }
    setReportsLoading(true);
    setReportsError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/complaints/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as MyReport[];
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setReports([]);
      setReportsError(e instanceof Error ? e.message : 'Could not load your reports.');
    } finally {
      setReportsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in first', description: 'You need to be signed in to contact customer care.' });
      return;
    }
    const trimmedSubject = subject.trim();
    const trimmedDetails = details.trim();
    if (trimmedSubject.length < 3) {
      toast({ variant: 'destructive', title: 'Add a short subject', description: 'Tell us in a few words what happened.' });
      return;
    }
    if (trimmedDetails.length < 10) {
      toast({ variant: 'destructive', title: 'Add a few more details', description: 'A sentence or two helps the team act on your report.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createComplaint({
        complainantId: user.uid,
        targetType: topic === 'other' ? 'system' : topic,
        reason: trimmedSubject,
        description: trimmedDetails,
        orderId: topic === 'order' ? orderId.trim() || undefined : undefined,
      });
      if (!result.success) throw new Error(result.error || 'Could not send your report.');
      toast({
        title: 'Report sent',
        description: 'Customer care has your message — follow its status under “Your reports”.',
      });
      setSubject('');
      setDetails('');
      setOrderId('');
      setFormOpen(false);
      await loadReports();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not send your report',
        description: error instanceof Error ? error.message : 'Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Help articles (unchanged behaviour) ───────────────────────────────
  const articlesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'helpArticles'),
      where('audience', 'array-contains', 'buyer'),
    );
  }, [firestore]);

  const { data: articles, isLoading } = useCollection<BuyerHelpArticle>(articlesQuery);

  const grouped = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = (articles ?? [])
      .filter((a) => a.question || a.answer)
      .filter((a) =>
        !needle
          ? true
          : `${a.question ?? ''} ${a.answer ?? ''} ${a.category ?? ''}`
              .toLowerCase()
              .includes(needle),
      );

    const map = new Map<string, BuyerHelpArticle[]>();
    for (const article of list) {
      const key = article.category || 'General';
      const bucket = map.get(key);
      if (bucket) bucket.push(article);
      else map.set(key, [article]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [articles, term]);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle eyebrow="Support" title="Customer care" />

      {/* ── The direct line — the reason this screen exists ───────────── */}
      <section className="px-4">
        <div className="vn-buyer-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/25 text-cyan-600 dark:text-cyan-300">
              <Headphones className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">Talk to customer care</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Order problems, a seller or buyer to report, a listing that should not
                be up — every message is read by the care team.
              </p>
            </div>
          </div>

          {formOpen ? (
            <form onSubmit={submitReport} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="care-topic" className="vn-micro block text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  What is this about?
                </label>
                <Select value={topic} onValueChange={(value) => setTopic(value as TopicValue)}>
                  <SelectTrigger id="care-topic" className="h-11">
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="care-subject" className="vn-micro block text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Subject
                </label>
                <Input
                  id="care-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Order never arrived"
                  maxLength={120}
                />
              </div>

              {topic === 'order' && (
                <div className="space-y-1.5">
                  <label htmlFor="care-order" className="vn-micro block text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    Order number <span className="normal-case tracking-normal">(optional)</span>
                  </label>
                  <Input
                    id="care-order"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="The order you need help with"
                    maxLength={80}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="care-details" className="vn-micro block text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  What happened?
                </label>
                <Textarea
                  id="care-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the problem so the team can act on it…"
                  rows={4}
                  maxLength={2000}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="h-11 flex-1 font-bold uppercase tracking-wider">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={isSubmitting}
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" className="mt-4 h-11 w-full font-bold uppercase tracking-wider" onClick={() => setFormOpen(true)}>
              Report an issue
            </Button>
          )}
        </div>
      </section>

      {/* ── What I filed, and where it stands ──────────────────────────── */}
      <section className="space-y-2 px-4">
        <div className="flex items-center justify-between">
          <h2 className="vn-micro pb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Your reports
          </h2>
          {!reportsLoading && !reportsError && reports.length > 0 && (
            <button
              type="button"
              onClick={() => void loadReports()}
              className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              Refresh
            </button>
          )}
        </div>

        {reportsLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : reportsError ? (
          <div className="vn-buyer-card p-3.5">
            <p className="text-xs text-muted-foreground">{reportsError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void loadReports()}>
              Try again
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <p className="vn-buyer-card p-3.5 text-xs leading-relaxed text-muted-foreground">
            You haven&apos;t reached out yet — anything you send to customer care shows
            up here with its status.
          </p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const meta = STATUS_META[r.status ?? 'open'] ?? STATUS_META.open;
              const created = r.createdAt ? new Date(r.createdAt) : null;
              return (
                <div key={r.id} className="vn-buyer-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {r.reason || 'Report'}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {typeLabelFor(r.targetType)}
                    {created && ` · ${created.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── The knowledge base ─────────────────────────────────────────── */}
      <section className="space-y-3 px-4">
        <h2 className="vn-micro pb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Common questions
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search help articles"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vn-skeleton h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <BuyerEmptyState
            icon={FileQuestion}
            title={term ? 'No matches' : 'No answers yet'}
            body={
              term
                ? 'Nothing in the knowledge base matches that. Try a shorter phrase.'
                : 'Help articles for buyers have not been published yet.'
            }
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                Contact customer care
              </Button>
            }
          />
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {grouped.map(([category, list]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="font-semibold">{category}</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-4 pl-4">
                    {list.map((article) => (
                      <li key={article.id}>
                        <p className="font-bold text-foreground">{article.question}</p>
                        {article.answer && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {article.answer}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>

      {/* The four things a buyer actually opens help for. */}
      <section className="space-y-2 px-4">
        <h2 className="vn-micro pb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Go straight there
        </h2>
        {QUICK_ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="vn-buyer-card flex items-center gap-3 p-3.5 transition hover:scale-[1.01]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{route.label}</span>
              <span className="block truncate font-sans text-[11px] text-muted-foreground">
                {route.hint}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </section>
    </div>
  );
}
