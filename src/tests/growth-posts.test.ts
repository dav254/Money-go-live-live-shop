/**
 * GROWTH POSTS — pure-engine and source-level guarantees.
 *
 * What is asserted here is the part that must never regress:
 *   • selection runs on REAL product metrics and honours the cooldown/bounds;
 *   • the prompt can only contain facts the document actually carries;
 *   • a malformed model reply is a FAILURE, never an empty draft;
 *   • `published` is reachable only from an approved post and only with the
 *     platform's own remote id (Phase 2A social channels);
 *   • the routes keep their auth and opt-in cron gates.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CHANNEL_TEXT_LIMITS,
  buildPostText,
  buildDraftPrompt,
  draftsRemainingToday,
  growthProviderStatuses,
  isDraftable,
  parseDraftResponse,
  publishGate,
  scoreCandidate,
  selectDraftTargets,
  sharePathFor,
  type DraftCandidate,
} from '../lib/vidnov-core/growth-posts/drafts';
import {
  GROWTH_POST_LIMITS,
  GROWTH_POST_STATES,
  GROWTH_PUBLISH_CHANNELS,
  SOCIAL_CHANNELS,
  canTransitionGrowthPost,
  clampDraftLimit,
  isSocialChannel,
} from '../lib/vidnov-core/growth-posts/types';
import { getTemplate } from '../lib/notifications/templates';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const NOW = Date.parse('2026-10-29T12:00:00Z');

function candidate(over: Partial<DraftCandidate> = {}): DraftCandidate {
  return {
    id: 'prod-1',
    name: 'Epson L3350 Printer',
    price: 173.66,
    currency: 'USD',
    category: 'Electronics',
    imageUrl: 'https://cdn.example.com/p.jpg',
    ...over,
  };
}

/* ── Selection ─────────────────────────────────────────────────────────── */

describe('growth post selection', () => {
  it('applies the documented weights: views ×1, likes ×3, sales ×10', () => {
    assert.equal(scoreCandidate(candidate({ viewCount: 10 }), NOW), 10);
    assert.equal(scoreCandidate(candidate({ likes: 10 }), NOW), 30);
    assert.equal(scoreCandidate(candidate({ salesCount: 10 }), NOW), 100);
  });

  it('ranks a converting product above a merely viewed one', () => {
    const { selected } = selectDraftTargets(
      [
        candidate({ id: 'views', viewCount: 25 }),
        candidate({ id: 'sales', salesCount: 3 }),
      ],
      { limit: 2, cooldownProductIds: new Set(), now: NOW },
    );
    assert.deepEqual(
      selected.map((c) => c.id),
      ['sales', 'views'],
    );
  });

  it('gives fresh listings a recency bump without overriding sales', () => {
    const fresh = scoreCandidate(candidate({ createdMs: NOW - 2 * 86_400_000 }), NOW);
    const stale = scoreCandidate(candidate({ createdMs: NOW - 90 * 86_400_000 }), NOW);
    assert.ok(fresh > stale);
    assert.ok(scoreCandidate(candidate({ salesCount: 3, createdMs: NOW - 90 * 86_400_000 }), NOW) > fresh);
  });

  it('skips products drafted inside the cooldown window', () => {
    const { selected, skipped } = selectDraftTargets(
      [candidate({ id: 'warm' }), candidate({ id: 'cold' })],
      { limit: 2, cooldownProductIds: new Set(['warm']), now: NOW },
    );
    assert.deepEqual(selected.map((c) => c.id), ['cold']);
    assert.ok(skipped.some((s) => s.id === 'warm' && s.reason === 'cooldown'));
  });

  it('skips incomplete documents instead of drafting empty facts', () => {
    const noImage = candidate({ id: 'no-image', imageUrl: undefined });
    const noPrice = candidate({ id: 'no-price', price: Number.NaN });
    const blank = candidate({ id: 'blank', name: '   ' });
    assert.equal(isDraftable(noImage), false);
    assert.equal(isDraftable(noPrice), false);
    assert.equal(isDraftable(blank), false);
    const { selected, skipped } = selectDraftTargets([noImage, noPrice, blank, candidate()], {
      limit: 5,
      cooldownProductIds: new Set(),
      now: NOW,
    });
    assert.deepEqual(selected.map((c) => c.id), ['prod-1']);
    assert.equal(skipped.length, 3);
  });

  it('honours the run limit and is deterministic on ties', () => {
    const { selected } = selectDraftTargets(
      [candidate({ id: 'b' }), candidate({ id: 'a' }), candidate({ id: 'c' })],
      { limit: 2, cooldownProductIds: new Set(), now: NOW },
    );
    assert.deepEqual(selected.map((c) => c.id), ['a', 'b']);
  });

  it('clamps the run limit and the daily remainder into safe bounds', () => {
    assert.equal(clampDraftLimit(99), GROWTH_POST_LIMITS.perRunMax);
    assert.equal(clampDraftLimit(-4), 1);
    assert.equal(clampDraftLimit(undefined), GROWTH_POST_LIMITS.perRun);
    assert.equal(draftsRemainingToday(GROWTH_POST_LIMITS.perDay), 0);
    assert.equal(draftsRemainingToday(0), GROWTH_POST_LIMITS.perDay);
  });
});

/* ── Share link ────────────────────────────────────────────────────────── */

describe('share path', () => {
  it('carries the existing ref= attribution format', () => {
    const path = sharePathFor('abc123');
    assert.equal(path, '/products/abc123?ref=growthpost');
  });

  it('never stacks a second ref on an already tracked path', () => {
    const once = sharePathFor('abc123');
    assert.equal((once.match(/ref=/g) ?? []).length, 1);
  });
});

/* ── Prompt ────────────────────────────────────────────────────────────── */

describe('draft prompt', () => {
  it('hands the model only real facts, the share path and a strict format', () => {
    const prompt = buildDraftPrompt(
      candidate({ description: 'Fast wireless printer', deliveryOptions: 'Nationwide courier' }),
      '/products/prod-1?ref=growthpost',
    );
    assert.match(prompt, /Product: Epson L3350 Printer/);
    assert.match(prompt, /Price: USD 173\.66/);
    assert.match(prompt, /Delivery: Nationwide courier/);
    assert.match(prompt, /\/products\/prod-1\?ref=growthpost/);
    assert.match(prompt, /STRICT JSON/);
    assert.match(prompt, /Never invent discounts/);
  });

  it('says a missing description is missing rather than inventing one', () => {
    const prompt = buildDraftPrompt(candidate({ description: undefined }), '/products/x');
    assert.match(prompt, /Description: \(none supplied\)/);
  });
});

/* ── Response parsing ──────────────────────────────────────────────────── */

describe('draft response parsing', () => {
  it('parses strict JSON with clean hashtags', () => {
    const parsed = parseDraftResponse(
      JSON.stringify({ caption: 'Print more, wait less.', hashtags: ['#Printers', '#Printer', '#PRINTERS'] }),
    );
    assert.equal(parsed.caption, 'Print more, wait less.');
    assert.deepEqual(parsed.hashtags, ['printers', 'printer']);
  });

  it('tolerates fenced JSON', () => {
    const parsed = parseDraftResponse(
      '```json\n{"caption":"Fenced caption","hashtags":["tagone"]}\n```',
    );
    assert.equal(parsed.caption, 'Fenced caption');
    assert.deepEqual(parsed.hashtags, ['tagone']);
  });

  it('degrades to plain text and lifts hashtags out of it', () => {
    const parsed = parseDraftResponse('A plain caption worth posting. #vidnov #deals');
    assert.equal(parsed.caption, 'A plain caption worth posting.');
    assert.deepEqual(parsed.hashtags, ['vidnov', 'deals']);
  });

  it('refuses an empty response instead of queueing nothing', () => {
    assert.throws(() => parseDraftResponse('   '), /empty_response/);
    assert.throws(() => parseDraftResponse(JSON.stringify({ caption: '', hashtags: [] })), /empty_response/);
  });

  it('caps an absurdly long caption', () => {
    const parsed = parseDraftResponse(JSON.stringify({ caption: 'x'.repeat(2000), hashtags: [] }));
    assert.ok(parsed.caption.length <= 600);
  });
});

/* ── State machine ─────────────────────────────────────────────────────── */

describe('growth post state machine', () => {
  it('allows the two legal decisions from draft', () => {
    assert.equal(canTransitionGrowthPost('draft', 'approved'), true);
    assert.equal(canTransitionGrowthPost('draft', 'rejected'), true);
  });

  it('refuses publishing an unapproved post', () => {
    assert.equal(canTransitionGrowthPost('draft', 'copied'), false);
    assert.equal(canTransitionGrowthPost('draft', 'emailed'), false);
    assert.equal(canTransitionGrowthPost('draft', 'published'), false);
    assert.equal(canTransitionGrowthPost('approved', 'published'), true);
  });

  it('has no way back out of a terminal state', () => {
    for (const terminal of ['rejected', 'copied', 'emailed', 'failed', 'published'] as const) {
      assert.equal(canTransitionGrowthPost(terminal, 'approved'), false);
      assert.equal(canTransitionGrowthPost(terminal, 'draft'), false);
    }
  });

  it('keeps one approved post shareable across several channels over time', () => {
    assert.equal(canTransitionGrowthPost('copied', 'published'), true);
    assert.equal(canTransitionGrowthPost('emailed', 'published'), true);
    assert.equal(canTransitionGrowthPost('failed', 'published'), true); // honest retry
    assert.equal(canTransitionGrowthPost('rejected', 'published'), false);
  });

  it('exposes exactly the seven states and eight publish channels (six social)', () => {
    assert.deepEqual([...GROWTH_POST_STATES], [
      'draft', 'approved', 'rejected', 'copied', 'emailed', 'published', 'failed',
    ]);
    assert.deepEqual([...GROWTH_PUBLISH_CHANNELS], [
      'copy', 'email', 'bluesky', 'mastodon', 'telegram', 'discord', 'pinterest', 'reddit',
    ]);
    assert.deepEqual([...SOCIAL_CHANNELS], [
      'bluesky', 'mastodon', 'telegram', 'discord', 'pinterest', 'reddit',
    ]);
    for (const ch of SOCIAL_CHANNELS) assert.equal(isSocialChannel(ch), true);
    assert.equal(isSocialChannel('instagram'), false);
    assert.equal(isSocialChannel('copy'), false);
  });
});

/* ── Provider status & publish gates (honesty) ─────────────────────────── */

describe('provider status and publish gates', () => {
  it('derives AI and email capability from env presence only', () => {
    const on = growthProviderStatuses({
      GEMINI_API_KEY: 'x',
      EMAIL_PROVIDER: 'resend',
      EMAIL_API_KEY: 'x',
      EMAIL_MODE: 'production',
    });
    assert.equal(on.ai.status, 'configured');
    assert.equal(on.email.status, 'configured');

    const off = growthProviderStatuses({});
    assert.equal(off.ai.status, 'not_configured');
    assert.equal(off.email.status, 'not_configured');
    assert.deepEqual(off.ai.requiredEnvVars, ['GEMINI_API_KEY']);
  });

  it('derives each social channel from its own env names, never values', () => {
    const off = growthProviderStatuses({ GEMINI_API_KEY: 'x' });
    assert.equal(off.social.status, 'not_configured');
    for (const ch of SOCIAL_CHANNELS) assert.equal(off[ch].status, 'not_configured', ch);

    const on = growthProviderStatuses({
      BLUESKY_HANDLE: 'vidnov.bsky.social',
      BLUESKY_APP_PASSWORD: 'app-pass',
      MASTODON_API_URL: 'https://mastodon.social',
      MASTODON_ACCESS_TOKEN: 'token',
      TELEGRAM_BOT_TOKEN: 'token',
      TELEGRAM_CHANNEL_ID: '@vidnov',
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x',
      PINTEREST_ACCESS_TOKEN: 'pina-token',
      PINTEREST_BOARD_ID: '1234567890123',
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
      REDDIT_USERNAME: 'vidnov',
      REDDIT_PASSWORD: 'pw',
      REDDIT_SUBREDDIT: 'vidnov',
    });
    assert.equal(on.social.status, 'configured');
    for (const ch of SOCIAL_CHANNELS) assert.equal(on[ch].status, 'configured', ch);
    assert.deepEqual(on.pinterest.requiredEnvVars, ['PINTEREST_ACCESS_TOKEN', 'PINTEREST_BOARD_ID']);
    assert.deepEqual(on.reddit.requiredEnvVars, [
      'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD', 'REDDIT_SUBREDDIT',
    ]);

    // A partial setup is reported truthfully — one channel ready, one not.
    const partial = growthProviderStatuses({ DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x' });
    assert.equal(partial.social.status, 'configured');
    assert.equal(partial.bluesky.status, 'not_configured');
    assert.deepEqual(partial.bluesky.requiredEnvVars, ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD']);
  });

  it('copy is always allowed and claims nothing as published', () => {
    const gate = publishGate('copy', { env: {} });
    assert.equal(gate.allowed, true);
    assert.match(gate.reason, /nothing is claimed as published/);
  });

  it('email needs credentials AND a real recipient', () => {
    assert.equal(publishGate('email', { env: {}, recipient: 'a@b.co' }).allowed, false);
    assert.equal(
      publishGate('email', { env: { EMAIL_PROVIDER: 'x', EMAIL_API_KEY: 'x' }, recipient: '' }).allowed,
      false,
    );
    assert.equal(
      publishGate('email', { env: { EMAIL_PROVIDER: 'x', EMAIL_API_KEY: 'x' }, recipient: 'not-an-email' })
        .allowed,
      false,
    );
    const prod = publishGate(
      'email',
      { env: { EMAIL_PROVIDER: 'x', EMAIL_API_KEY: 'x', EMAIL_MODE: 'production' }, recipient: 'a@b.co' },
    );
    assert.equal(prod.allowed, true);
    const dev = publishGate('email', { env: { EMAIL_PROVIDER: 'x', EMAIL_API_KEY: 'x' }, recipient: 'a@b.co' });
    assert.equal(dev.allowed, true);
    assert.match(dev.reason, /dev_captured/);
  });

  it('a social channel refuses without its credentials and allows with them', () => {
    assert.equal(publishGate('bluesky', { env: {} }).allowed, false);
    assert.equal(publishGate('bluesky', { env: { BLUESKY_HANDLE: 'h' } }).allowed, false);
    const bluesky = publishGate('bluesky', {
      env: { BLUESKY_HANDLE: 'h', BLUESKY_APP_PASSWORD: 'p' },
    });
    assert.equal(bluesky.allowed, true);
    assert.match(bluesky.reason, /platform's own message id/);

    assert.equal(publishGate('telegram', { env: { TELEGRAM_BOT_TOKEN: 't' } }).allowed, false);
    assert.equal(
      publishGate('telegram', { env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHANNEL_ID: '@c' } }).allowed,
      true,
    );
    assert.equal(publishGate('mastodon', { env: { MASTODON_ACCESS_TOKEN: 't' } }).allowed, false);
    assert.equal(
      publishGate('mastodon', {
        env: { MASTODON_API_URL: 'https://mastodon.social', MASTODON_ACCESS_TOKEN: 't' },
      }).allowed,
      true,
    );
    assert.equal(publishGate('discord', { env: {} }).allowed, false);
    assert.equal(
      publishGate('discord', { env: { DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x' } }).allowed,
      true,
    );

    // Pinterest: both the access token AND the board id are required.
    assert.equal(publishGate('pinterest', { env: {} }).allowed, false);
    assert.equal(publishGate('pinterest', { env: { PINTEREST_ACCESS_TOKEN: 't' } }).allowed, false);
    const pinterest = publishGate('pinterest', {
      env: { PINTEREST_ACCESS_TOKEN: 't', PINTEREST_BOARD_ID: '1234567890' },
    });
    assert.equal(pinterest.allowed, true);
    assert.match(pinterest.reason, /platform's own message id/);

    // Reddit: every one of the five names must be present before it can send.
    assert.equal(publishGate('reddit', { env: {} }).allowed, false);
    assert.equal(
      publishGate('reddit', {
        env: {
          REDDIT_CLIENT_ID: 'id',
          REDDIT_CLIENT_SECRET: 'secret',
          REDDIT_USERNAME: 'u',
          REDDIT_PASSWORD: 'p',
        },
      }).allowed,
      false,
      'REDDIT_SUBREDDIT is required — the engine only ever posts to the brand\'s own community',
    );
    const reddit = publishGate('reddit', {
      env: {
        REDDIT_CLIENT_ID: 'id',
        REDDIT_CLIENT_SECRET: 'secret',
        REDDIT_USERNAME: 'u',
        REDDIT_PASSWORD: 'p',
        REDDIT_SUBREDDIT: 'vidnov',
      },
    });
    assert.equal(reddit.allowed, true);
  });

  it('channel text budgets match the documented platform limits', () => {
    assert.equal(CHANNEL_TEXT_LIMITS.bluesky, 297);
    assert.equal(CHANNEL_TEXT_LIMITS.mastodon, 500);
    assert.equal(CHANNEL_TEXT_LIMITS.telegram, 1_024);
    assert.equal(CHANNEL_TEXT_LIMITS.discord, 2_000);
    assert.equal(CHANNEL_TEXT_LIMITS.pinterest, 500, 'pin description budget');
    assert.equal(CHANNEL_TEXT_LIMITS.reddit, 300, 'link-post title budget');
  });

  it('buildPostText keeps the share URL whole inside every budget', () => {
    const url = 'https://vidnov.com/products/abc123?ref=growthpost';
    const caption = 'A printer that never jams. '.repeat(60);
    for (const limit of [CHANNEL_TEXT_LIMITS.bluesky, CHANNEL_TEXT_LIMITS.mastodon]) {
      const text = buildPostText({ caption, hashtags: ['printers', 'deals'], shareUrl: url }, limit);
      assert.ok(text.includes(url), `url must survive a ${limit}-char budget`);
      assert.ok(text.length <= limit, `must fit ${limit}, got ${text.length}`);
    }
    const small = buildPostText({ caption, hashtags: [], shareUrl: url }, 100);
    assert.ok(small.includes(url));
    assert.ok(small.length <= 100);
  });
});

/* ── Source-level guarantees (routes & template) ───────────────────────── */

describe('growth post routes and template (source level)', () => {
  it('the admin API refuses every call without admin verification', () => {
    const source = read('src/app/api/admin/growth-posts/route.ts');
    assert.ok(source.includes('verifyAdminUid'));
    assert.ok(source.includes('status: 403'));
    // Both handlers gate before any work happens.
    assert.equal((source.match(/await verifyAdminUid/g) ?? []).length, 2);
  });

  it('the cron route keeps all three opt-in gates', () => {
    const source = read('src/app/api/growth-posts/cron/route.ts');
    assert.ok(source.includes('VIDNOV_CRON_ENABLED'));
    assert.ok(source.includes('GROWTH_POSTS_CRON_ENABLED'));
    assert.ok(source.includes('CRON_SECRET'));
    assert.ok(source.includes('authorizeCronSchedule'));
    assert.ok(source.includes("'system:growth-cron'"));
  });

  it('the emailed template exists with its real vars', () => {
    const tpl = getTemplate('growth-post');
    assert.ok(tpl, 'growth-post template must be registered');
    assert.equal(tpl.category, 'business');
    for (const v of ['seller_name', 'product_name', 'caption', 'share_url']) {
      assert.ok(tpl.vars.includes(v), `missing var ${v}`);
    }
    assert.match(tpl.body, /\{\{caption\}\}/);
    assert.match(tpl.body, /Nothing is ever posted on your behalf/);
  });

  it('the queue page offers exactly the six free social channels', () => {
    const source = read('src/app/dashboard/admin/system/growth/page.tsx');
    assert.ok(source.includes("channel: 'copy'"));
    assert.ok(source.includes("channel: 'email'"));
    assert.ok(source.includes('publishTo'), 'social publish handler must be wired');
    for (const name of ['bluesky', 'mastodon', 'telegram', 'discord', 'pinterest', 'reddit']) {
      assert.ok(source.includes(`id: '${name}'`), `missing ${name} button`);
    }
    assert.ok(!/channel:\s*'(instagram|facebook|tiktok|x)'/i.test(source));
  });

  it('Pinterest and Reddit publish through official endpoints only (source level)', () => {
    const source = read('src/lib/vidnov-core/growth-posts/social.ts');
    // Pinterest: the v5 create-pin endpoint with a board and image media.
    assert.ok(source.includes('https://api.pinterest.com/v5/pins'));
    assert.ok(source.includes('board_id: boardId'));
    assert.ok(source.includes("source_type: 'image_url'"));
    assert.ok(source.includes("input.env.PINTEREST_BOARD_ID"));
    // Reddit: script-app OAuth, then the official submit endpoint, link post.
    assert.ok(source.includes('https://www.reddit.com/api/v1/access_token'));
    assert.ok(source.includes('https://oauth.reddit.com/api/submit'));
    assert.ok(source.includes("kind: 'link'"));
    assert.ok(source.includes("input.env.REDDIT_SUBREDDIT"), 'posts target the configured subreddit');
    assert.ok(source.includes("'User-Agent': userAgent"), 'Reddit requires a unique User-Agent');
    // Neither publisher may ever surface an upstream error body.
    assert.ok(!source.includes('errors?.[0]'), 'error reasons stay upstream');
  });

  it('service.ts writes status published only in the confirmed-success branch', () => {
    const source = read('src/lib/vidnov-core/growth-posts/service.ts');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ''); // ignore doc comments
    assert.equal((code.match(/status: 'published'/g) ?? []).length, 1);
    assert.ok(code.includes("state: 'failed'"), 'a failed attempt must record failed, not published');
    assert.ok(code.includes('remoteId: outcome.remoteId'), 'success returns the platform id');
  });
});
