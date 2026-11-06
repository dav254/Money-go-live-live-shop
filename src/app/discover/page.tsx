/**
 * /discover — the unified customer discovery surface.
 *
 * BOTH businesses and individual listings, in one experience, over the data the
 * marketplace already has: `businesses`, `products` (products AND services) and
 * the seller account/shop documents behind them. Nothing is duplicated and
 * nothing is fabricated — an ineligible seller simply does not appear.
 *
 * The first page is rendered on the server, so the page is real HTML for a
 * crawler as well as a customer; the client shell then takes over for typing,
 * filtering and paging.
 */

import type { Metadata } from 'next';
import { db } from '@/firebase/server';
import { kenyaLocations } from '@/lib/location-data';
import { publicOrigin } from '@/lib/site-url';
import { parseDiscoverQuery, searchDiscover, type DiscoverPage } from '@/lib/discover/search';
import { DiscoverShell, type DiscoverQueryState } from '@/components/discover/discover-shell';

export const dynamic = 'force-dynamic';

const TITLE = 'Discover businesses, products and services';
const DESCRIPTION =
  'Search every Vidnov seller at once — shops and businesses, individual products and bookable services — then filter by category, county and availability.';

export const metadata: Metadata = {
  title: `${TITLE} | Vidnov`,
  description: DESCRIPTION,
  alternates: { canonical: `${publicOrigin()}/discover` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${publicOrigin()}/discover`,
    siteName: 'Vidnov',
    type: 'website',
  },
};

/** JSON-LD is built only from entities that actually passed the eligibility gate. */
function itemListJsonLd(items: DiscoverPage['items']): string | null {
  if (items.length === 0) return null;
  const origin = publicOrigin();
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITLE,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${origin}${item.kind === 'business' ? item.shopHref : item.href}`,
    })),
  };
  // `<` must be escaped: a seller-controlled name must never be able to close
  // the script element.
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export default async function DiscoverPageRoute(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params.set(key, value);
  }

  const parsed = parseDiscoverQuery(params);

  const query: DiscoverQueryState = parsed.ok
    ? {
        q: parsed.value.q,
        kind: parsed.value.kind,
        category: parsed.value.category,
        location: parsed.value.location,
        availability: parsed.value.availability,
        sort: parsed.value.sort,
      }
    : { q: '', kind: 'all', availability: 'any', sort: 'relevance' };

  let initial: DiscoverPage | null = null;
  let initialError: string | null = parsed.ok ? null : parsed.error;

  if (parsed.ok) {
    try {
      initial = await searchDiscover(db, parsed.value);
    } catch {
      // Never a 500: a discovery page that cannot reach the catalogue should
      // still render its search box and an honest explanation.
      console.error('[discover] initial search failed');
      initialError = 'Discovery could not be loaded right now. Please try again.';
    }
  }

  const jsonLd = initial ? itemListJsonLd(initial.items) : null;

  return (
    <main className="min-h-screen bg-background">
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      ) : null}

      <section className="border-b border-border/60 bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-4xl">
            Find the shop behind the thing you need
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            One search across every Vidnov seller — verified shops and businesses, individual
            products, and services you can book or request. Filter by category, county and what is
            available today.
          </p>
        </div>
      </section>

      <DiscoverShell
        initial={initial}
        initialError={initialError}
        initialState={query}
        counties={Object.keys(kenyaLocations).sort((a, b) => a.localeCompare(b))}
      />
    </main>
  );
}
