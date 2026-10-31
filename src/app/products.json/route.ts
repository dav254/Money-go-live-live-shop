/**
 * `/products.json` — the structured public catalogue for AI agents and
 * shopping pipelines.
 *
 * One fetch returns the real, visibility-filtered catalogue with exactly the
 * facts an agent needs to quote a listing honestly: canonical URL, name,
 * price/currency (only when the document sets one), availability (only when
 * unambiguous), images, video, category, condition, seller id, last update —
 * plus an honest `source` (`pocketbase` | `firestore`) and `generatedAt`.
 *
 * Contract (mirrors `src/app/sitemap.ts`):
 * - force-dynamic so the feed never serves a stale snapshot.
 * - An empty catalogue is served as an empty (but valid) payload — never a
 *   500, never invented rows.
 * - Only public listings enter the feed: same `isPublicListingDoc` rules,
 *   same suspended-owner deny-set as the sitemap.
 */
import { buildProductsPayload, loadSeoCatalogue } from '@/lib/seo/catalogue-feed';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let body: string;
  try {
    const catalogue = await loadSeoCatalogue();
    body = buildProductsPayload(catalogue);
  } catch {
    body = JSON.stringify({
      generatedAt: new Date().toISOString(),
      productCount: 0,
      shopCount: 0,
      products: [],
      shops: [],
    });
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
