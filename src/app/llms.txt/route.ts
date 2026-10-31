/**
 * `/llms.txt` — the machine-readable index of what this marketplace sells.
 *
 * The llms.txt convention (llmstxt.org) is a markdown file at the site root
 * that gives LLM agents a curated, link-first overview: one heading per
 * section, one `- [Name](url)` line per real listing or shop, with price and
 * category only where the document carries them. Agents fetch this ONE file
 * instead of crawling blindly; `/products.json` (linked from it) carries the
 * full structured catalogue with media.
 *
 * Contract (mirrors `src/app/sitemap.ts`):
 * - force-dynamic: the catalogue changes with every seller upload.
 * - An empty/unavailable catalogue serves a truthful empty document — never
 *   a 500 (an error page here looks like a broken site to every agent) and
 *   never fabricated entries.
 * - Content-Type is text/plain — this is not HTML.
 */
import { buildLlmsText, loadSeoCatalogue } from '@/lib/seo/catalogue-feed';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let body: string;
  try {
    const catalogue = await loadSeoCatalogue();
    body = buildLlmsText(catalogue);
  } catch {
    // Never 500: an honest minimal file keeps the agent on the site.
    body = `# Vidnov\n\nThe public catalogue is temporarily unavailable. See the sitemap at /sitemap.xml.\n`;
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
