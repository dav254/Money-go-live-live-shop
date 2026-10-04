'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, FileQuestion, Search } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Input } from '@/components/ui/input';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · HELP CENTRE.
 *
 * The seller section has a Customer Care screen; the buyer section had nothing,
 * so `/buyer/help` sat behind an escape. This reads the same `helpArticles`
 * collection the website reads, filtered to `audience array-contains 'buyer'`.
 *
 * The article shape is declared locally rather than imported: the website page
 * imports `HelpArticle` from `@/lib/types`, but that type is not exported there,
 * so the import does not resolve. Copying it would import the same defect.
 */

interface BuyerHelpArticle {
  id: string;
  question?: string;
  answer?: string;
  category?: string;
}

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
  const [term, setTerm] = React.useState('');

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
      <BuyerSectionTitle eyebrow="Support" title="Help centre" />

      <div className="px-4">
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
      </div>

      {isLoading ? (
        <div className="space-y-2.5 px-4">
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
            <Link
              href="/app/buyer/orders"
              className="vn-buyer-card px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Go to my orders
            </Link>
          }
        />
      ) : (
        <div className="px-4">
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
        </div>
      )}

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