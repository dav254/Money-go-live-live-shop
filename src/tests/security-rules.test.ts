/**
 * Static validation of Firestore security rules + domain-hygiene checks.
 * Run: npx tsx --test src/tests/security-rules.test.ts
 *
 * The Firestore emulator needs Java, which is unavailable in this sandbox —
 * these tests cover the failure modes we actually hit: collections read by
 * admin pages but missing from the rules, default-deny drift between the two
 * rules copies, and hardcoded domains in app code.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const DEPLOYED_RULES = readFileSync(join(ROOT, 'src', 'firestore.rules'), 'utf8');

/** Collections that admin pages subscribe to with useCollection (client SDK). */
const ADMIN_CLIENT_READS = [
  'activityLogs',
  'errorLogs',
  'admins',
  'contentModerationQueue',
  'fraudAlerts',
  'adminChat',
  'complaints',
  'supportTickets',
  'walletTransactions',
  'userProfiles',
  'orders',
  'payments',
  'payouts',
  'homepageSlides',
  'helpArticles',
  'liveSessions',
  'products',
  'sellerShops',
  'notifications',
  'emailLogs',
  'devMailbox',
  'securityEvents',
  'conversations',
  'resellActivities',
];

describe('firestore security rules', () => {
  it('deployed rules file (src/firestore.rules per firebase.json) has a default-deny catch-all', () => {
    assert.match(DEPLOYED_RULES, /match\s+\/\{document=\*\*\}\s*\{[\s\S]*?allow\s+read,\s*write:\s*if\s+false/);
  });

  it('has an isAdmin() helper based on server-side userRole lookup', () => {
    assert.match(DEPLOYED_RULES, /function\s+isAdmin\(\)[\s\S]*?userRole\s*==\s*'admin'/);
  });

  for (const collection of ADMIN_CLIENT_READS) {
    it(`collection "${collection}" is readable by admins (no permission-denied on admin pages)`, () => {
      const re = new RegExp(`match\\s+/${collection}/\\{[a-zA-Z]+\\}\\s*\\{`);
      assert.match(DEPLOYED_RULES, re, `add a match /${collection}/ rule to src/firestore.rules`);
    });
  }

  it('notifications are readable by signed-in users (bell + notification center)', () => {
    assert.match(DEPLOYED_RULES, /match\s+\/notifications\/\{notificationId\}\s*\{[\s\S]*?allow\s+read,\s*write:\s*if\s+isSignedIn/);
  });

  it('emailLogs and devMailbox are admin-only (never world-readable)', () => {
    for (const c of ['emailLogs', 'devMailbox']) {
      const block = DEPLOYED_RULES.match(new RegExp(`match\\s+/${c}/\\{\\w+\\}\\s*\\{([\\s\\S]*?)\\n    \\}`));
      assert.ok(block, `missing rule for ${c}`);
      assert.match(block[1], /isAdmin/);
      assert.doesNotMatch(block[1], /allow\s+read[^;]*:\s*if\s+true/);
    }
  });

  it('passwordResetTokens are never client-readable', () => {
    assert.doesNotMatch(DEPLOYED_RULES, /match\s+\/passwordResetTokens\/[\s\S]*?allow\s+(read|get|list)/);
  });

  it('both rules copies (root + src) are in sync', () => {
    const rootRules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');
    assert.equal(rootRules.trim(), DEPLOYED_RULES.trim(), 'firestore.rules and src/firestore.rules differ');
  });
});

describe('domain hygiene (no hardcoded vidnov.com)', () => {
  it('notification engine builds links only from APP_URL', () => {
    const config = readFileSync(join(ROOT, 'src', 'lib', 'notifications', 'config.ts'), 'utf8');
    assert.doesNotMatch(config, /vidnov\.com/);
    assert.match(config, /APP_URL/);
  });

  it('auth API routes never hardcode the production domain', () => {
    for (const f of ['forgot-password', 'reset-password', 'sessions', 'welcome', 'notify-password-changed']) {
      const src = readFileSync(join(ROOT, 'src', 'app', 'api', 'auth', f, 'route.ts'), 'utf8');
      assert.doesNotMatch(src, /vidnov\.com/, `${f} hardcodes the domain`);
    }
  });

  it('email templates use {{vars}}, not literal domains', () => {
    const tpl = readFileSync(join(ROOT, 'src', 'lib', 'notifications', 'templates.ts'), 'utf8');
    assert.doesNotMatch(tpl, /vidnov\.com/);
  });
});

describe('communication engine: renderer safety', () => {
  // Import compiled-through-tsx modules directly.
  const { renderTemplate, escapeHtml } = require(join(ROOT, 'src', 'lib', 'notifications', 'renderer.ts'));

  it('escapeHtml neutralizes injection payloads', () => {
    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(escapeHtml(`" onclick="x`), '&quot; onclick=&quot;x');
  });

  it('renderTemplate substitutes known vars', () => {
    const out = renderTemplate('Hi {{user_name}}, total {{currency}} {{amount}}', {
      user_name: 'Ada', currency: 'KES', amount: '250',
    });
    assert.equal(out.text, 'Hi Ada, total KES 250');
  });

  it('unknown vars are stripped, never passed through raw', () => {
    const out = renderTemplate('Hello {{first_name}} {{last_name}}!', { first_name: 'Ada' });
    assert.equal(out.text, 'Hello Ada !');
  });

  it('conditional blocks render only when the var exists', () => {
    const tpl = 'Start{{#product_name}} for {{product_name}}{{/product_name}} end';
    assert.equal(renderTemplate(tpl, { product_name: 'Chair' }).text, 'Start for Chair end');
    assert.equal(renderTemplate(tpl, {}).text, 'Start end');
  });

  it('HTML output escapes variable content (script injection blocked)', () => {
    const out = renderTemplate('Hi {{user_name}}', { user_name: '<img src=x onerror=alert(1)>' });
    assert.match(out.html, /&lt;img/);
    assert.doesNotMatch(out.html, /<img/);
  });

  it('link vars render as anchors with escaped hrefs', () => {
    const out = renderTemplate('Reset: {{reset_link}}', { reset_link: 'https://app.example/reset?token=a&b' });
    assert.match(out.html, /<a href="https:\/\/app\.example\/reset\?token=a&amp;b"/);
  });
});
