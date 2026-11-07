import { cookies } from 'next/headers';

import {
  MARKETING_CONSENT_COOKIE,
  parseConsentCookie,
} from '@/lib/cookie-consent';
import { metaPixelNoScriptSrc } from '@/lib/meta-pixel';

/**
 * Meta's `noscript` fallback, rendered only for visitors who already granted
 * marketing consent.
 *
 * Meta ships this image so browsers without JavaScript are still counted. On a
 * consent-gated install it cannot simply be pasted into the layout: a
 * `<noscript>` renders for everyone whose browser does not run scripts, and
 * those visitors can never have pressed "Allow" (the banner needs JS). An
 * unconditional image would therefore track every no-JS visitor without
 * consent — exactly what the consent gate exists to prevent.
 *
 * Reading the cookie server-side is what makes both requirements true at once:
 * the image is present for a visitor who consented earlier, and absent for
 * everyone else. `cookies()` makes the layout dynamic, which is the deliberate
 * cost of a correctly gated fallback.
 */
export async function MetaPixelNoscript() {
  const store = await cookies();
  const decision = parseConsentCookie(store.get(MARKETING_CONSENT_COOKIE)?.value ?? null);
  if (decision !== 'granted') return null;

  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height="1"
        width="1"
        alt=""
        style={{ display: 'none' }}
        src={metaPixelNoScriptSrc()}
      />
    </noscript>
  );
}
