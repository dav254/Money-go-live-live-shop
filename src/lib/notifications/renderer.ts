/**
 * VIDNOV template renderer — safe {{var}} substitution.
 *
 * Security model: templates are inert strings. Rendering ONLY replaces
 * {{var}} placeholders from a provided map; every value is HTML-escaped for
 * the HTML output and raw for plain text. No evaluation, no HTML injection
 * from variable content. Unknown {{...}} placeholders become empty strings,
 * and a custom {{#var}}...{{/var}} conditional block renders only when `var`
 * has a truthy value. Vars whose name ends in _link/_url render as anchors
 * in the HTML output (with escaped hrefs) when they hold an http(s) URL.
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

function expandConditionals(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(CONDITIONAL_RE, (_m, name: string, inner: string) => (vars[name] ? inner : ''));
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined> = {},
): { subject?: string; html: string; text: string } {
  // ----- Plain text: raw values, unknown vars stripped -----
  const text = expandConditionals(template, vars).replace(VAR_RE, (_m, name: string) => vars[name] ?? '');

  // ----- HTML pipeline -----
  // 1. Conditionals first (raw truthiness).
  let html = expandConditionals(template, vars);

  // 2. Link vars become anchors BEFORE generic substitution so their raw
  //    URL is available (then escaped inside the anchor).
  html = html.replace(LINK_VAR_RE, (_m, name: string) => {
    const raw = vars[name];
    if (raw && /^https?:\/\//.test(raw)) {
      return `<a href="${escapeHtml(raw)}" style="color:#FF4D2E;font-weight:600">${escapeHtml(raw)}</a>`;
    }
    return '';
  });

  // 3. Every remaining var is escaped — variable content can never inject markup.
  html = html.replace(VAR_RE, (_m, name: string) => escapeHtml(vars[name] ?? ''));

  // 4. Newlines become line breaks.
  html = html.replace(/\n/g, '<br/>');

  const subjectMatch = template.match(/^subject:\s*(.+)$/m);
  const subject = subjectMatch ? text.split('\n').find(l => l.startsWith('subject:'))?.replace(/^subject:\s*/, '') : undefined;

  return { subject, html, text };
}
