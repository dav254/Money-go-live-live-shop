/**
 * `/indexnow-key.txt` — publishes the IndexNow verification key.
 *
 * The protocol is intentionally keyless-in-secret: we choose any
 * 32-character hexadecimal value, publish it HERE at this exact path, and
 * send the same value plus `keyLocation` in every ping payload. IndexNow
 * crawlers fetch this file to prove the pings come from this host.
 *
 * The key is not a credential (it grants nothing — it only proves origin),
 * which is why it lives in code rather than in an environment variable.
 * See `src/lib/seo/indexnow.ts` for the ping side.
 */
import { INDEXNOW_KEY } from '@/lib/seo/indexnow';

export async function GET(): Promise<Response> {
  return new Response(`${INDEXNOW_KEY}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
