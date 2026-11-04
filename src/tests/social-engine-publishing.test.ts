/**
 * SOCIAL ENGINE — publishing safety and diagnostic tests.
 *
 * Every case injects a fake `fetch`, so nothing here reaches a provider, a
 * Firestore document or a real audience. The point is the honesty contract:
 * success requires a real provider id, failures stay failures, refusals stay
 * refusals, and a credential never appears in a note.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NEUTRAL_TEST_COPY, publishTest } from '../lib/social-engine/publishing';
import { runDiagnostics } from '../lib/social-engine/diagnostics';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CALLER = { uid: 'admin-uid-1', isAdmin: true };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const TELEGRAM_ENV = {
  TELEGRAM_BOT_TOKEN: 'BOT_TOKEN_SHOULD_NEVER_LEAK',
  TELEGRAM_BOT_USERNAME: '@vidnov_bot',
  TELEGRAM_CHANNEL_ID: '@vidnov',
};

function telegramCtx(fetchLike: FetchLike, confirm = true) {
  return {
    module: 'telegram' as const,
    ownerId: 'admin-uid-1',
    caller: CALLER,
    env: TELEGRAM_ENV as Record<string, string | undefined>,
    fetchLike,
    confirm,
  };
}

describe('Social Engine — publish test gating', () => {
  it('refuses without explicit confirmation and never calls the provider', async () => {
    let called = false;
    const outcome = await publishTest('telegram', {
      ...telegramCtx(async () => {
        called = true;
        return json({});
      }, false),
    });
    assert.equal(outcome.ok, false);
    assert.match(outcome.note, /Not confirmed/);
    assert.equal(called, false);
  });

  it('refuses a truthy string as confirmation', async () => {
    const outcome = await publishTest('telegram', {
      ...telegramCtx(async () => json({})),
      confirm: 'true' as unknown as boolean,
    });
    assert.equal(outcome.ok, false);
    assert.match(outcome.note, /Not confirmed/);
  });

  it('refuses when the env credentials are missing', async () => {
    const outcome = await publishTest('telegram', {
      module: 'telegram',
      ownerId: 'admin-uid-1',
      caller: CALLER,
      env: {},
      fetchLike: async () => json({}),
      confirm: true,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.remoteId, undefined);
  });

  it('has no publish test for infrastructure modules', async () => {
    for (const module of ['urls', 'publishing', 'livekit', 'pocketbase', 'google'] as const) {
      const outcome = await publishTest(module, {
        module,
        ownerId: 'admin-uid-1',
        caller: CALLER,
        env: {},
        fetchLike: async () => json({}),
        confirm: true,
      });
      assert.equal(outcome.ok, false);
      assert.match(outcome.note, /diagnostic/i);
    }
  });
});

describe('Social Engine — publish outcome honesty', () => {
  it('reports the provider id on a real success', async () => {
    const outcome = await publishTest(
      'telegram',
      telegramCtx(async () => json({ ok: true, result: { message_id: 42 } })),
    );
    assert.equal(outcome.ok, true);
    assert.equal(outcome.remoteId, '42');
    assert.equal(outcome.event, 'post_confirmed_published');
    assert.match(outcome.note, /neutral test message published/);
  });

  it('sends the neutral copy, never marketing text', async () => {
    let sentBody = '';
    await publishTest(
      'telegram',
      telegramCtx(async (_input, init) => {
        sentBody = String(init?.body ?? '');
        return json({ ok: true, result: { message_id: 7 } });
      }),
    );
    const body = JSON.parse(sentBody) as { text?: string };
    assert.equal(body.text, NEUTRAL_TEST_COPY);
    assert.match(NEUTRAL_TEST_COPY, /safe to ignore/);
  });

  it('does not claim success when the provider rejects the post', async () => {
    const outcome = await publishTest('telegram', telegramCtx(async () => json({ ok: false }, 500)));
    assert.equal(outcome.ok, false);
    assert.equal(outcome.remoteId, undefined);
    assert.match(outcome.note, /500/);
  });

  it('does not record an id when the provider accepts without one', async () => {
    const outcome = await publishTest('telegram', telegramCtx(async () => json({ ok: false })));
    assert.equal(outcome.ok, false);
    assert.equal(outcome.remoteId, undefined);
    assert.equal(outcome.event, undefined);
  });

  it('never echoes a credential into the note', async () => {
    const outcome = await publishTest(
      'telegram',
      telegramCtx(async () => json({ access_token: 'LEAKED_SECRET', error: 'unauthorized' }, 401)),
    );
    assert.equal(outcome.ok, false);
    assert.equal(outcome.note.includes('LEAKED_SECRET'), false);
    assert.equal(outcome.note.includes(TELEGRAM_ENV.TELEGRAM_BOT_TOKEN), false);
  });
});

describe('Social Engine — Mastodon uses the credentials it is given', () => {
  function mastodonCtx(fetchLike: FetchLike) {
    return {
      module: 'mastodon' as const,
      ownerId: 'admin-uid-1',
      caller: CALLER,
      env: {
        MASTODON_API_URL: 'https://mastodon.social/',
        MASTODON_ACCESS_TOKEN: 'MASTODON_TOKEN_SHOULD_NEVER_LEAK',
      } as Record<string, string | undefined>,
      fetchLike,
      confirm: true,
    };
  }

  it('publishes through the shared engine at the configured instance', async () => {
    let calledUrl = '';
    const outcome = await publishTest(
      'mastodon',
      mastodonCtx(async (input) => {
        calledUrl = input;
        return json({ id: 'status-1', url: 'https://mastodon.social/@vidnov/1' });
      }),
    );
    // The trailing slash is stripped, so the path is never doubled.
    assert.equal(calledUrl, 'https://mastodon.social/api/v1/statuses');
    assert.equal(outcome.ok, true);
    assert.equal(outcome.remoteId, 'https://mastodon.social/@vidnov/1');
    assert.equal(outcome.event, 'post_confirmed_published');
    assert.equal(outcome.note.includes('MASTODON_TOKEN_SHOULD_NEVER_LEAK'), false);
  });

  it('stays a failure when the instance rejects the status', async () => {
    const outcome = await publishTest('mastodon', mastodonCtx(async () => json({ error: 'nope' }, 422)));
    assert.equal(outcome.ok, false);
    assert.equal(outcome.remoteId, undefined);
    assert.match(outcome.note, /422/);
  });
});

describe('Social Engine — media preparation test', () => {
  it('validates a real asset against every platform profile', async () => {
    const outcome = await publishTest('media', {
      module: 'media',
      ownerId: 'admin-uid-1',
      caller: CALLER,
      env: {},
      confirm: true,
      fetchLike: async () =>
        new Response(new Uint8Array(10 * 1024), {
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': String(10 * 1024) },
        }),
    });
    assert.equal(outcome.ok, true);
    assert.match(outcome.note, /Media preparation validated/);
  });

  it('fails honestly when the asset cannot be fetched', async () => {
    const outcome = await publishTest('media', {
      module: 'media',
      ownerId: 'admin-uid-1',
      caller: CALLER,
      env: {},
      confirm: true,
      fetchLike: async () => new Response('missing', { status: 404 }),
    });
    assert.equal(outcome.ok, false);
    assert.match(outcome.note, /Could not fetch/);
  });

  it('fails honestly for a content type the pipeline rejects', async () => {
    const outcome = await publishTest('media', {
      module: 'media',
      ownerId: 'admin-uid-1',
      caller: CALLER,
      env: {},
      confirm: true,
      fetchLike: async () =>
        new Response('x', { status: 200, headers: { 'content-type': 'text/html', 'content-length': '10' } }),
    });
    assert.equal(outcome.ok, false);
    assert.match(outcome.note, /does not accept/);
  });
});

describe('Social Engine — diagnostics', () => {
  it('refuses when the module is not configured, naming the env var only', async () => {
    const outcome = await runDiagnostics('telegram', {
      env: {},
      ownerId: 'admin-uid-1',
      caller: CALLER,
    });
    assert.equal(outcome.steps.length, 0);
    assert.match(outcome.refuse ?? '', /TELEGRAM_BOT_TOKEN/);
  });

  it('records a failed auth step without leaking the bot token', async () => {
    const outcome = await runDiagnostics('telegram', {
      env: TELEGRAM_ENV,
      ownerId: 'admin-uid-1',
      caller: CALLER,
      fetchLike: async () => json({ access_token: 'LEAKED_SECRET' }, 401),
    });
    assert.equal(outcome.refuse, undefined);
    assert.equal(outcome.steps.length, 1);
    assert.equal(outcome.steps[0].kind, 'auth');
    assert.equal(outcome.steps[0].ok, false);
    assert.match(outcome.steps[0].note, /401/);
    assert.equal(outcome.steps[0].note.includes('LEAKED_SECRET'), false);
    assert.equal(outcome.steps[0].note.includes(TELEGRAM_ENV.TELEGRAM_BOT_TOKEN), false);
  });

  it('verifies the destination and posting permission on success', async () => {
    const seen: string[] = [];
    const outcome = await runDiagnostics('telegram', {
      env: TELEGRAM_ENV,
      ownerId: 'admin-uid-1',
      caller: CALLER,
      fetchLike: async (input) => {
        seen.push(input.includes('getMe') ? 'getMe' : input.includes('getChatMember') ? 'member' : 'chat');
        if (input.includes('getMe')) {
          return json({ ok: true, result: { id: 99, username: 'vidnov_bot', can_join_groups: true } });
        }
        if (input.includes('getChatMember')) {
          return json({ ok: true, result: { status: 'administrator', can_post: true } });
        }
        return json({ ok: true, result: { type: 'channel', title: 'Vidnov' } });
      },
    });
    assert.deepEqual(seen, ['getMe', 'chat', 'member']);
    const diagnostic = outcome.steps.find((step) => step.kind === 'diagnostic');
    assert.ok(diagnostic);
    assert.equal(diagnostic?.ok, true);
    assert.equal(diagnostic?.permissions?.granted, true);
  });

  it('reports a configured bot that cannot post as a failed diagnostic', async () => {
    const outcome = await runDiagnostics('telegram', {
      env: TELEGRAM_ENV,
      ownerId: 'admin-uid-1',
      caller: CALLER,
      fetchLike: async (input) => {
        if (input.includes('getMe')) return json({ ok: true, result: { id: 99, username: 'vidnov_bot' } });
        if (input.includes('getChatMember')) return json({ ok: true, result: { status: 'left', can_post: false } });
        return json({ ok: true, result: { type: 'channel' } });
      },
    });
    const diagnostic = outcome.steps.find((step) => step.kind === 'diagnostic');
    assert.equal(diagnostic?.ok, false);
    assert.match(diagnostic?.note ?? '', /cannot post|may not post/i);
  });

  it('answers for Facebook and Instagram instead of "Unknown module"', async () => {
    for (const module of ['facebook', 'instagram'] as const) {
      const outcome = await runDiagnostics(module, { env: {}, ownerId: 'admin-uid-1', caller: CALLER });
      const text = [outcome.refuse ?? '', ...outcome.steps.map((step) => step.note)].join(' ');
      assert.equal(/Unknown module/.test(text), false, `${module} fell through to the unknown branch`);
    }
  });

  it('verifies configuration-only modules without the network', async () => {
    const urls = await runDiagnostics('urls', { env: {}, ownerId: 'admin-uid-1', caller: CALLER });
    assert.equal(urls.steps[0].ok, true);
    assert.match(urls.steps[0].note, /Canonical origin/);

    const media = await runDiagnostics('media', { env: {}, ownerId: 'admin-uid-1', caller: CALLER });
    assert.equal(media.steps[0].ok, true);
    assert.match(media.steps[0].note, /Media limits loaded/);

    // LiveKit's verdict depends on the host environment (the sandbox may or
    // may not hold LIVEKIT_*), so only the shape is asserted here.
    const livekit = await runDiagnostics('livekit', { env: {}, ownerId: 'admin-uid-1', caller: CALLER });
    assert.equal(livekit.steps.length, 1);
    assert.equal(livekit.steps[0].kind, 'diagnostic');
    assert.equal(typeof livekit.steps[0].ok, 'boolean');
    assert.ok(livekit.steps[0].note.length > 0);
  });

  it('never throws an upstream body into a step note', async () => {
    const outcome = await runDiagnostics('telegram', {
      env: TELEGRAM_ENV,
      ownerId: 'admin-uid-1',
      caller: CALLER,
      fetchLike: async () => {
        throw new Error('socket hang up');
      },
    });
    assert.equal(outcome.steps[0].ok, false);
    assert.match(outcome.steps[0].note, /network/);
  });
});
