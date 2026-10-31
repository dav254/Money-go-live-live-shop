/**
 * SHOP SEO LAYOUT — server-side head for `/sellers/[sellerId]`.
 *
 * Mirror of the product segment layout: the shop page stays a client
 * component, so `generateMetadata` (real shop name, description, logo,
 * canonical) and a `Store` JSON-LD graph are emitted here into the initial
 * HTML for crawlers that never run JavaScript.
 *
 * Difference from the product segment: a MISSING shop document does NOT get
 * `noindex`. The seller page also renders from the buyer-facing profile, so
 * a seller without a `sellerShops` document still has a real, public page —
 * only a VERIFIED hidden shop is de-indexed (and `unknown` again stays
 * silent, so an outage de-indexes nothing).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { publicUrl } from '@/lib/site-url';
import { readPublicShopSeoCached } from '@/lib/seo/listing-reader';
import {
  absUrl,
  buildBreadcrumbJsonLd,
  buildShopJsonLd,
  cleanText,
  serializeJsonLd,
} from '@/lib/seo/json-ld';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ sellerId: string }> };
type LayoutProps = Params & { children: ReactNode };

function metaDescription(doc: Record<string, unknown>): string | undefined {
  const description = cleanText(doc.description, 160);
  if (description) return description;
  const name = cleanText(doc.shopName, 80);
  if (!name) return undefined;
  const parts = [name];
  const category = cleanText(doc.category, 40);
  if (category) parts.push(category);
  return `${parts.join(' · ')} — shop on Vidnov.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { sellerId } = await params;
  const listing = await readPublicShopSeoCached(sellerId);

  if (listing.state === 'public' && listing.doc) {
    const doc = listing.doc;
    const name = cleanText(doc.shopName, 70);
    const title = name ? `${name} | Vidnov` : 'Shop | Vidnov';
    const description = metaDescription(doc);
    const url = publicUrl(`/sellers/${sellerId}`);
    const logo = absUrl(doc.logoUrl);
    return {
      title,
      ...(description ? { description } : {}),
      alternates: { canonical: url },
      openGraph: {
        title,
        ...(description ? { description } : {}),
        url,
        siteName: 'Vidnov',
        ...(logo ? { images: [{ url: logo }] } : {}),
      },
      twitter: {
        card: logo ? 'summary_large_image' : 'summary',
        title,
        ...(description ? { description } : {}),
      },
      robots: { index: true, follow: true },
    };
  }

  if (listing.state === 'hidden') {
    return { robots: { index: false, follow: false } };
  }
  // `missing` and `unknown`: the page can still be real — leave robots alone.
  return {};
}

export default async function ShopSeoLayout({ children, params }: LayoutProps) {
  const { sellerId } = await params;
  const listing = await readPublicShopSeoCached(sellerId);
  if (listing.state !== 'public' || !listing.doc) return <>{children}</>;

  const doc = listing.doc;
  const name = cleanText(doc.shopName, 200) ?? 'Shop';
  const graphs: unknown[] = [];

  const shop = buildShopJsonLd(doc, sellerId);
  if (shop) graphs.push(shop);

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: 'Vidnov', url: publicUrl('/') },
    { name, url: publicUrl(`/sellers/${sellerId}`) },
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
