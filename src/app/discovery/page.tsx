/**
 * /discovery — the immersive Discovery experience.
 *
 * Three connected panels over one surface, exactly as designed:
 *
 *   1. DISCOVER — the full-screen, snap-scrolled vertical feed (one listing per
 *      screen, video autoplaying only while visible).
 *   2. THEMES   — editorial collections built from the real category, county
 *      and live-stream data.
 *   3. SHOP     — the searchable catalogue of products and services.
 *
 * `/discover` remains the server-rendered search page (`?q=…` results, JSON-LD,
 * indexable HTML); this route is the media-first experience the design called
 * for, and it is what the main "Discover" entry points now open.
 *
 * Nothing here is a second marketplace: the feed, the collections and the
 * catalogue all read the same Firestore documents through the same APIs as the
 * rest of Vidnov.
 */

import type { Metadata } from 'next';

import { DiscoverySection } from '@/components/discovery/discovery-section';
import { publicOrigin } from '@/lib/site-url';

const TITLE = 'Discovery — watch, explore and shop Vidnov';
const DESCRIPTION =
  'A media-first marketplace: scroll products, services, shops and live selling in one feed, explore curated themes, then buy in the shop.';

export const metadata: Metadata = {
  title: `${TITLE} | Vidnov`,
  description: DESCRIPTION,
  alternates: { canonical: `${publicOrigin()}/discovery` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${publicOrigin()}/discovery`,
    siteName: 'Vidnov',
    type: 'website',
  },
};

export default function DiscoveryPage() {
  return <DiscoverySection />;
}
