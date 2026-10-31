/**
 * VIDNOV template renderer — safe {{var}} substitution.
 *
 * Security model: templates are inert strings. Rendering ONLY replaces
 * {{var}} placeholders from a provided map; every value is HTML-escaped for
 * the HTML output and raw for plain text. No evaluation, no HTML injection
 * from variable content. Unknown {{...}} placeholders become empty strings,
 * and a custom {{#var}}...{{/var}} conditional block renders only when `var`
 * has a truthy value. Vars whose name ends in _link/_url render as coral
 * call-to-action buttons in the HTML output (with escaped hrefs) when they
 * hold an http(s) URL.
 *
 * Output shapes:
 *   text — the template with the `subject:` header line removed (the subject
 *          is returned separately), so a message body never repeats it;
 *   html — the same content wrapped in the responsive Vidnov layout:
 *          near-black canvas, charcoal card, coral accents, white primary
 *          text. Deliberately image-free (no tracking pixels, no CDN
 *          dependency — it renders identically in every client).
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

const CONDITIONAL_RE = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const VAR_RE = /\{\{(\w+)\}\}/g;
const LINK_VAR_RE = /\{\{(\w+(?:_link|_url))\}\}/g;
const SUBJECT_LINE_RE = /^subject:[^\n]*\n?/;

function expandConditionals(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(CONDITIONAL_RE, (_m, name: string, inner: string) => (vars[name] ? inner : ''));
}

/**
 * The branded responsive shell: dark canvas → charcoal card → coral accents.
 * Table-based for Outlook, `max-width` + viewport meta for phones, system
 * font stack, and zero images so nothing depends on an external CDN.
 */
function wrapEmailHtml(innerHtml: string, subject: string | undefined): string {
  const year = new Date().getFullYear();
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="dark light" />',
    `<title>${escapeHtml(subject ?? 'Vidnov')}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:24px 8px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141417;border:1px solid #26262b;border-radius:16px;">',
    '<tr><td style="padding:26px 28px 4px 28px;">',
    '<span style="font-size:19px;font-weight:800;letter-spacing:0.14em;color:#ffffff;text-decoration:none;">VID<span style="color:#ff4d2e;">NOV</span></span>',
    '</td></tr>',
    '<tr><td style="padding:12px 28px 28px 28px;font-size:15px;line-height:1.65;color:#e7e7ea;">',
    innerHtml,
    '</td></tr>',
    '<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid #26262b;">',
    '<p style="margin:0;font-size:12px;line-height:1.6;color:#8b8b94;">',
    `You received this message because your Vidnov account uses this address. Reply to reach our team. © ${year} Vidnov.`,
    '</p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined> = {},
): { subject?: string; html: string; text: string } {
  // ----- Plain text: raw values, unknown vars stripped -----
  let text = expandConditionals(template, vars).replace(VAR_RE, (_m, name: string) => vars[name] ?? '');

  // ----- Subject: extracted AFTER substitution, then removed from BOTH
  // outputs so a message never repeats its own subject line inline.
  const hasSubject = template.startsWith('subject:');
  let subject: string | undefined;
  const bodyTemplate = hasSubject ? template.replace(SUBJECT_LINE_RE, '') : template;
  if (hasSubject) {
    subject = text.split('\n', 1)[0].replace(/^subject:\s*/, '');
    text = text.replace(SUBJECT_LINE_RE, '');
  }

  // ----- HTML pipeline (runs on the RAW template so escaping still happens
  // after substitution, never on pre-substituted text) -----
  // 1. Conditionals first (raw truthiness).
  let html = expandConditionals(bodyTemplate, vars);

  // 2. Link vars become CTA buttons BEFORE generic substitution so their raw
  //    URL is available (escaped inside the anchor). Any other anchor the
  //    template writes by hand keeps a simple coral style.
  html = html.replace(LINK_VAR_RE, (_m, name: string) => {
    const raw = vars[name];
    if (raw && /^https?:\/\//.test(raw)) {
      return (
        `<a href="${escapeHtml(raw)}" style="display:inline-block;margin:14px 6px 6px 0;padding:13px 26px;` +
        `background:#ff4d2e;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:999px;">` +
        `${escapeHtml(raw)}</a>`
      );
    }
    return '';
  });

  // 3. Every remaining var is escaped — variable content can never inject markup.
  html = html.replace(VAR_RE, (_m, name: string) => escapeHtml(vars[name] ?? ''));

  // 4. Newlines become line breaks.
  html = html.replace(/\n/g, '<br/>');

  return { subject, html: wrapEmailHtml(html, subject), text };
}
