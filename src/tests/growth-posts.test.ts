/**
 * GROWTH POSTS — pure-engine and source-level guarantees.
 *
 * The marketing queue is MANUAL FIRST. What is asserted here is the part that
 * must never regress:
 *   • no AI drafting exists anywhere in the workflow (no Gemini call, no
 *     nightly draft route, no generated copy);
 *   • a post is created by an administrator and enters the queue as a draft —
 *     it is never auto-approved;
 *   • `published` is reachable only from an approved post and only with the
 *     platform's own remote id (social channels);
 *   • the routes keep their auth and opt-in scheduler gates.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  CHANNEL_TEXT_LIMITS,
  buildPostText,
  growthProviderStatuses,
  publishGate,
  sharePathFor,
} from '../lib/vidnov-core/growth-posts/drafts';
import {
  GROWTH_POST_LIMITS,
  GROWTH_POST_STATES,
  GROWTH_PUBLISH_CHANNELS,
  SOCIAL_CHANNELS,
  canTransitionGrowthPost,
  isSocialChannel,
} from '../lib/vidnov-core/growth-posts/types';
import { getTemplate } from '../lib/notifications/templates';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const exists = (p: string) => existsSync(join(process.cwd(), p));

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

  it('keeps the scheduler bounds bounded', () => {
    assert.equal(GROWTH_POST_LIMITS.schedulerPerRun, 5);
    assert.equal(GROWTH_POST_LIMITS.schedulerChannelsMax, 4);
    assert.ok(GROWTH_POST_LIMITS.scheduleMaxAheadDays <= 90);
    assert.ok(GROWTH_POST_LIMITS.scheduleMinAheadMs >= 60_000);
  });
});

/* ── Provider status & publish gates (honesty) ─────────────────────────── */

describe('provider status and publish gates', () => {
  it('reports email capability from env presence only, with no AI provider', () => {
    const on = growthProviderStatuses({
      EMAIL_PROVIDER: 'resend',
      EMAIL_API_KEY: 'x',
      EMAIL_MODE: 'production',
    });
    assert.equal(on.email.status, 'configured');

    const off = growthProviderStatuses({});
    assert.equal(off.email.status, 'not_configured');
    assert.deepEqual(off.email.requiredEnvVars, ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_MODE']);

    // The AI drafting provider was removed from the workflow entirely.
    assert.equal(Object.prototype.hasOwnProperty.call(off, 'ai'), false);
    assert.deepEqual(
      Object.keys(off).sort(),
      ['bluesky', 'discord', 'email', 'mastodon', 'pinterest', 'reddit', 'social', 'telegram'],
    );
  });

  it('derives each social channel from its own env names, never values', () => {
    const off = growthProviderStatuses({});
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

  it('exposes only manual actions: compose, edit, decide, publish, schedule, unschedule', () => {
    const source = read('src/app/api/admin/growth-posts/route.ts');
    const actions = [...source.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]).sort();
    assert.deepEqual(actions, ['compose', 'decide', 'edit', 'publish', 'schedule', 'unschedule']);
    assert.equal(source.includes("case 'draft'"), false);
    assert.equal(source.includes('runGrowthDraftJob'), false);
  });

  it('has no AI drafting module, route or Gemini reference in the workflow', () => {
    assert.equal(exists('src/lib/vidnov-core/growth-posts/ai.ts'), false);
    assert.equal(exists('src/app/api/growth-posts/cron/route.ts'), false);

    for (const path of [
      'src/lib/vidnov-core/growth-posts/service.ts',
      'src/lib/vidnov-core/growth-posts/drafts.ts',
      'src/lib/vidnov-core/growth-posts/types.ts',
      'src/app/api/admin/growth-posts/route.ts',
      'src/app/api/growth-posts/scheduler/route.ts',
      'src/app/dashboard/admin/system/growth/page.tsx',
    ]) {
      const source = read(path);
      assert.equal(/GEMINI|gemini|draftSocialPost/.test(source), false, `${path} still references AI drafting`);
    }
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

  it('the queue page has no AI draft control', () => {
    const source = read('src/app/dashboard/admin/system/growth/page.tsx');
    assert.equal(/Run draft job/.test(source), false);
    assert.equal(/action: 'draft'/.test(source), false);
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

  it('compose saves a draft and never approves it', () => {
    const source = read('src/lib/vidnov-core/growth-posts/service.ts');
    const start = source.indexOf('export async function composeGrowthPost');
    assert.ok(start > -1);
    const body = source.slice(start, source.indexOf('export async function updateGrowthPost'));
    assert.ok(body.includes("status: 'draft'"), 'composed posts must enter the review queue');
    assert.equal(/decidedBy/.test(body), false, 'compose must not record an approval decision');
    assert.equal(/status: 'approved'/.test(body), false);
    // …and there is a dedicated, state-preserving edit path.
    assert.ok(source.includes('export async function updateGrowthPost'));
  });
});
