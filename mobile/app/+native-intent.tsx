/**
 * DEEP-LINK TRANSLATION.
 *
 * Android hands the app URLs the WEBSITE publishes, but the app's routes are
 * named for the app's screens. Without this translation a verified link such as
 * https://vidnov.com/products/abc123 would land on "not found" even though the
 * asset-links verification succeeded.
 *
 *   /products/<id>  →  /listing/<id>
 *   /sellers/<id>   →  /shop/<id>
 *   /requests/<id>  →  /request/<id>
 *
 * Both shapes are handled: https links (App Links) and the custom
 * `vidnov://` scheme. Query strings survive the mapping, and any other URL is
 * returned untouched, so informational pages keep opening in the browser.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const isWebUrl = /^https?:\/\//i.test(path);
  let clean = path;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      clean = isWebUrl
        ? `${url.pathname}${url.search}${url.hash}`
        : `${url.host ? `/${url.host}` : ''}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return path;
    }
  }

  const match = clean.match(/^\/(products|sellers|requests)\/([^/?#]+)(.*)$/);
  if (!match) {
    // A custom-scheme link with no marketplace path still belongs to the app,
    // so hand back the normalised path; a web URL stays with the browser.
    return isWebUrl ? path : clean.startsWith('/') ? clean : `/${clean}`;
  }

  const [, section, id, rest] = match;
  const target =
    section === 'products' ? 'listing' : section === 'sellers' ? 'shop' : 'request';
  return `/${target}/${id}${rest ?? ''}`;
}
