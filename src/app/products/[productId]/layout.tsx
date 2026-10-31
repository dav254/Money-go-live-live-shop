/**
 * PRODUCT SEO LAYOUT — the segment's server-side head.
 *
 * The product page itself is a client component (`page.tsx` — its tests pin
 * that file), so everything a non-JavaScript crawler needs is emitted here,
 * in the initial HTML:
 *
 * - `generateMetadata` → title, description, canonical, OpenGraph/Twitter
 *   cards (images AND video), all built from the REAL document the mirror
 *   or Firestore vouches for. Verified-hidden or verified-missing listings
 *   get `noindex`; a source outage (`unknown`) deliberately gets NOTHING so
 *   a Firestore blip can never de-index a live listing.
 * - JSON-LD → `Product` + `Offer` graph and a Home-first breadcrumb,
 *   rendered after the page body. Only public documents ever produce a
 *   graph; hidden documents never reach this file's markup.
 *
 * One read per request (`React.cache` dedupes `generateMetadata` vs body).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { publicUrl } from '@/lib/site-url';
import { readPublicProductSeoCached } from '@/lib/seo/listing-reader';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  cleanText,
  productImageUrls,
  productVideoUrls,
  resolveOffer,
  serializeJsonLd,
} from '@/lib/seo/json-ld';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ productId: string }> };
type LayoutProps = Params & { children: ReactNode };

/**
 * Meta description from the document only: the real description first,
 * else the real identity fields — never a generic sales sentence invented
 * for this listing.
 */
function metaDescription(doc: Record<string, unknown>): string | undefined {
  const description = cleanText(doc.description, 160);
  if (description) return description;
  const parts: string[] = [];
  const name = cleanText(doc.name, 80);
  if (name) parts.push(name);
  const category = cleanText(doc.category, 40);
  if (category) parts.push(category);
  const offer = resolveOffer(doc);
  if (offer) parts.push(`${offer.currency} ${offer.price}`);
  if (!parts.length) return undefined;
  return `${parts.join(' · ')} — shop this listing on Vidnov.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { productId } = await params;
  const listing = await readPublicProductSeoCached(productId);

  if (listing.state === 'public' && listing.doc) {
    const doc = listing.doc;
    const name = cleanText(doc.name, 70);
    const title = name ? `${name} | Vidnov` : 'Marketplace listing | Vidnov';
    const description = metaDescription(doc);
    const url = publicUrl(`/products/${productId}`);
    const images = productImageUrls(doc);
    const videos = productVideoUrls(doc);
    return {
      title,
      ...(description ? { description } : {}),
      alternates: { canonical: url },
      openGraph: {
        title,
        ...(description ? { description } : {}),
        url,
        siteName: 'Vidnov',
        ...(images.length ? { images: [{ url: images[0] }] } : {}),
        ...(videos.length ? { videos: [{ url: videos[0] }] } : {}),
      },
      twitter: {
        card: images.length ? 'summary_large_image' : 'summary',
        title,
        ...(description ? { description } : {}),
      },
      robots: { index: true, follow: true },
    };
  }

  // Verified absent or verified unlisted → keep it out of the index.
  // (`unknown` falls through on purpose: an outage must not de-index.)
  if (listing.state === 'missing' || listing.state === 'hidden') {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

export default async function ProductSeoLayout({ children, params }: LayoutProps) {
  const { productId } = await params;
  const listing = await readPublicProductSeoCached(productId);
  if (listing.state !== 'public' || !listing.doc) return <>{children}</>;

  const doc = listing.doc;
  const name = cleanText(doc.name, 200) ?? 'Listing';
  const graphs: unknown[] = [];

  const product = buildProductJsonLd(doc, productId);
  if (product) graphs.push(product);

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: 'Vidnov', url: publicUrl('/') },
    { name, url: publicUrl(`/products/${productId}`) },
  ]);
  if (breadcrumb) graphs.push(breadcrumb);

  return (
    <>
      {children}
      {graphs.map((graph, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
        />
      ))}
    </>
  );
}
