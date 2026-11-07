/**
 * Meta Pixel identifiers — shared by the client component and the server
 * `noscript` fallback.
 *
 * Kept out of `components/meta-pixel.tsx` because that module is a client
 * component: importing a constant from it inside the server layout would give
 * the server a client reference proxy, not the string.
 */

/** Vidnov's Meta Pixel. A public identifier, not a secret. */
export const META_PIXEL_ID = '28731676109830564';

/** The official library URL — Meta's own snippet value. */
export const META_PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/**
 * The 1×1 tracking image Meta's install instructions pair with the script, for
 * browsers that do not run JavaScript.
 */
export function metaPixelNoScriptSrc(id: string = META_PIXEL_ID): string {
  return `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`;
}
