/**
 * VIDNOV ADMIN AI COMMAND CENTRE — contract tests.
 *
 * The Command Centre is only trustworthy if its honesty rules are executable.
 * These tests prove, without any real VPS, Ollama or Paperclip:
 *
 *   • every /api/mobile/admin route goes through the server-side admin gate,
 *   • a check that was not performed reports UNKNOWN, never ONLINE,
 *   • Ollama's "installed" is not treated as "running",
 *   • Paperclip invents no agents and claims no unverified capability,
 *   • an instruction produces a report that can never say it was executed,
 *   • a failed model call is recorded as failed, not silently swallowed,
 *   • the Android client never holds the Ollama address or key.
 *
 * A small local HTTP server stands in for Ollama/Paperclip. No network.
 */
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';

import {
  DEFAULT_OLLAMA_MODEL,
  ollamaConfig,
  openCodeConfig,
  paperclipConfig,
  publicOllamaConfig,
  publicOpenCodeConfig,
  publicPaperclipConfig,
} from '../lib/admin-ai/config';
import { probeOllama } from '../lib/admin-ai/ollama';
import { probeOpenCode } from '../lib/admin-ai/opencode';
import { probePaperclip } from '../lib/admin-ai/paperclip';
import { runInstruction } from '../lib/admin-ai/instructions';
import { summarizeReport } from '../lib/admin-ai/summary';
import {
  buildReport,
  extractNextStep,
  publicError,
  stateFromProbe,
  titleFromMessage,
} from '../lib/admin-ai/validate';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');

/* ── Fake upstream services ─────────────────────────────────────────────── */

interface FakeOptions {
  status?: number;
  payload?: unknown;
  onRequest?: (url: string, body: string) => void;
}

const servers: Server[] = [];

async function fakeServer(handler: (url: string, body: string) => FakeOptions): Promise<{ url: string }> {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const result = handler(request.url ?? '/', body);
      response.writeHead(result.status ?? 200, { 'Content-Type': 'application/json' });
      response.end(result.payload === undefined ? '{}' : JSON.stringify(result.payload));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake server did not bind');
  return { url: `http://127.0.0.1:${address.port}` };
}

after(() => {
  for (const server of servers) server.close();
});

const FAKE_MODEL = JSON.stringify({
  model: 'qwen2.5-coder:3b',
  message: { role: 'assistant', content: 'SUMMARY\nA read-only analysis.\n\nNext step: review the proposal.' },
  eval_count: 42,
});

/* ── Configuration is server-only ───────────────────────────────────────── */

describe('admin AI configuration', () => {
  it('defaults to the local Ollama address and Qwen model', () => {
    const config = ollamaConfig({});
    assert.ok(config);
    assert.equal(config.baseUrl, 'http://127.0.0.1:11434');
    assert.equal(config.model, DEFAULT_OLLAMA_MODEL);
    assert.equal(config.explicit, false);
  });

  it('trims trailing slashes and rejects non-http addresses', () => {
    assert.equal(ollamaConfig({ OLLAMA_BASE_URL: 'http://10.0.0.5:11434/' })?.baseUrl, 'http://10.0.0.5:11434');
    assert.equal(ollamaConfig({ OLLAMA_BASE_URL: 'file:///etc/passwd' }), null);
  });

  it('never exposes the base URL or API key to the client projection', () => {
    const publicView = publicOllamaConfig({
      OLLAMA_BASE_URL: 'http://secret-host:11434',
      OLLAMA_API_KEY: 'super-secret',
    });
    const serialized = JSON.stringify(publicView);
    assert.equal(publicView.configured, true);
    assert.equal(publicView.hasApiKey, true);
    assert.ok(!serialized.includes('secret-host'));
    assert.ok(!serialized.includes('super-secret'));
  });

  it('treats an unset Paperclip URL as unconfigured, not as connected', () => {
    assert.equal(paperclipConfig({}), null);
    assert.deepEqual(publicPaperclipConfig({}), { configured: false });
  });

  it('keeps the OpenCode address, workspace and password out of the client projection', () => {
    const publicView = publicOpenCodeConfig({
      OPENCODE_BASE_URL: 'http://secret-opencode:4096',
      OPENCODE_SERVER_PASSWORD: 'super-secret',
      OPENCODE_DIRECTORY: '/srv/secret-worktree',
      OPENCODE_MODEL_PROVIDER: 'provider',
      OPENCODE_MODEL_ID: 'model',
      OPENCODE_AGENT: 'build',
    });
    const serialized = JSON.stringify(publicView);
    assert.equal(publicView.configured, true);
    assert.equal(publicView.hasPassword, true);
    assert.equal(publicView.workspaceConfigured, true);
    assert.ok(!serialized.includes('secret-opencode'));
    assert.ok(!serialized.includes('super-secret'));
    assert.ok(!serialized.includes('/srv/secret-worktree'));
  });

  it('rejects a non-http OpenCode address and unsafe names', () => {
    assert.equal(openCodeConfig({ OPENCODE_BASE_URL: 'file:///etc/passwd' }), null);
    const config = openCodeConfig({ OPENCODE_AGENT: 'build; rm -rf /' });
    assert.equal(config?.agent, 'build');
  });
});

/* ── Status vocabulary ──────────────────────────────────────────────────── */

describe('honest status vocabulary', () => {
  it('says UNKNOWN when no probe was performed', () => {
    assert.equal(stateFromProbe({ configured: false, reachable: false }), 'unknown');
    assert.equal(stateFromProbe({ configured: false, reachable: true }), 'unknown');
  });

  it('separates an outage from a partially usable service', () => {
    assert.equal(stateFromProbe({ configured: true, reachable: false }), 'offline');
    assert.equal(stateFromProbe({ configured: true, reachable: true }), 'online');
    assert.equal(stateFromProbe({ configured: true, reachable: true, degraded: true }), 'degraded');
  });
});

/* ── Ollama ─────────────────────────────────────────────────────────────── */

describe('Ollama probing', () => {
  it('reports UNKNOWN without probing when the address is unusable', async () => {
    // An invalid address is treated as no configuration at all — the server
    // does not guess a host, and the client is told UNKNOWN, not OFFLINE.
    const status = await probeOllama({ OLLAMA_BASE_URL: 'not-a-url' });
    assert.equal(status.state, 'unknown');
    assert.equal(status.configured, false);
    assert.equal(status.reachable, false);
    assert.equal(status.models.length, 0);
  });

  it('measures version and models, and confirms the configured model is installed', async () => {
    const fake = await fakeServer((url) => {
      if (url === '/api/version') return { payload: { version: '0.9.1' } };
      if (url === '/api/tags') return { payload: { models: [{ name: 'qwen2.5-coder:3b', size: 2_000_000_000 }] } };
      return { status: 404 };
    });

    const status = await probeOllama({ OLLAMA_BASE_URL: fake.url, OLLAMA_MODEL: 'qwen2.5-coder:3b' });
    assert.equal(status.state, 'online');
    assert.equal(status.reachable, true);
    assert.equal(status.version, '0.9.1');
    assert.equal(status.models.length, 1);
    assert.equal(status.activeModelInstalled, true);
  });

  it('is DEGRADED when reachable but the configured model is missing', async () => {
    const fake = await fakeServer((url) => {
      if (url === '/api/version') return { payload: { version: '0.9.1' } };
      if (url === '/api/tags') return { payload: { models: [{ name: 'llama3:8b' }] } };
      return { status: 404 };
    });

    const status = await probeOllama({ OLLAMA_BASE_URL: fake.url, OLLAMA_MODEL: 'qwen2.5-coder:3b' });
    assert.equal(status.state, 'degraded');
    assert.equal(status.activeModelInstalled, false);
  });

  it('is DEGRADED when the model list is known to be empty', async () => {
    const fake = await fakeServer((url) => {
      if (url === '/api/version') return { payload: { version: '0.9.1' } };
      if (url === '/api/tags') return { payload: { models: [] } };
      return { status: 404 };
    });

    const status = await probeOllama({ OLLAMA_BASE_URL: fake.url, OLLAMA_MODEL: 'qwen2.5-coder:3b' });
    assert.equal(status.reachable, true);
    assert.equal(status.state, 'degraded');
    assert.equal(status.models.length, 0);
  });

  it('reports OFFLINE with an error when nothing is listening', async () => {
    // A local port that was bound and then released refuses quickly.
    const probe = await fakeServer(() => ({ payload: {} }));
    const port = Number(new URL(probe.url).port);
    for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));

    const status = await probeOllama({ OLLAMA_BASE_URL: `http://127.0.0.1:${port}` });
    assert.equal(status.state, 'offline');
    assert.equal(status.reachable, false);
    assert.ok(status.error);
    assert.equal(status.models.length, 0);
  });
});

/* ── Paperclip ──────────────────────────────────────────────────────────── */

describe('Paperclip probing', () => {
  it('reports UNKNOWN and zero agents when no API is configured', async () => {
    const status = await probePaperclip({});
    assert.equal(status.state, 'unknown');
    assert.equal(status.agentsAvailable, false);
    assert.equal(status.agents.length, 0);
    assert.equal(status.activityAvailable, false);
    assert.equal(status.reportsAvailable, false);
    assert.equal(status.pendingAvailable, false);
    assert.match(status.detail, /not configured/i);
  });

  it('displays exactly the agents the API reports, and nothing else', async () => {
    const fake = await fakeServer(() => ({
      payload: {
        agents: [
          { id: 'a1', name: 'Scout', role: 'researcher', status: 'idle', lastActiveAt: '2026-11-11T09:00:00.000Z' },
          { id: 'a2', name: 'Builder' },
        ],
      },
    }));

    const status = await probePaperclip({ PAPERCLIP_API_URL: fake.url });
    assert.equal(status.state, 'online');
    assert.equal(status.agentsAvailable, true);
    assert.equal(status.agents.length, 2);
    assert.equal(status.agents[0].name, 'Scout');
    assert.equal(status.agents[1].role, null);
    // Unverified capabilities stay false even though the agent list worked.
    assert.equal(status.activityAvailable, false);
    assert.equal(status.pendingAvailable, false);
  });

  it('is DEGRADED and invents nothing when the response shape is unknown', async () => {
    const fake = await fakeServer(() => ({ payload: { ok: true, message: 'hello' } }));
    const status = await probePaperclip({ PAPERCLIP_API_URL: fake.url });
    assert.equal(status.state, 'degraded');
    assert.equal(status.agentsAvailable, false);
    assert.equal(status.agents.length, 0);
  });

  it('reports OFFLINE on an HTTP error', async () => {
    const fake = await fakeServer(() => ({ status: 401, payload: { error: 'unauthorised' } }));
    const status = await probePaperclip({ PAPERCLIP_API_URL: fake.url });
    assert.equal(status.state, 'offline');
    assert.match(status.detail, /401/);
    assert.equal(status.agents.length, 0);
  });
});

/* ── Reports can never claim execution ─────────────────────────────────── */

describe('task reports', () => {
  it('marks every generated report as not executed and proposed-only', () => {
    const report = buildReport({
      id: 'r1',
      title: 'Rotate the API key',
      instruction: 'Rotate it',
      model: 'qwen2.5-coder:3b',
      status: 'completed',
      result: 'SUMMARY\nDone in theory.\n\nNext step: ask the founder.',
      startedAt: '2026-11-11T10:00:00.000Z',
      completedAt: '2026-11-11T10:00:02.000Z',
      latencyMs: 2000,
    });

    assert.equal(report.executed, false);
    assert.equal(report.proposedOnly, true);
    assert.deepEqual(report.filesChanged, []);
    assert.deepEqual(report.filesInspected, []);
    assert.match(report.verification, /^Not run/);
    assert.match(report.note, /No files, databases, services or repositories were read or modified/);
    assert.equal(report.nextStep, 'ask the founder.');
  });

  it('does not invent a next step when the model did not label one', () => {
    assert.equal(extractNextStep('Just some prose about caching.'), null);
  });

  it('summaries also force executed:false', () => {
    const summary = summarizeReport({ id: 'r', title: 't', result: 'x', executed: true });
    assert.equal(summary.executed, false);
    assert.equal(summary.proposedOnly, true);
  });

  it('keeps a failed model call as a visible failed report', async () => {
    const fake = await fakeServer(() => ({ status: 500, payload: { error: 'model failed to load' } }));
    const report = await runInstruction({
      instruction: 'Investigate the checkout failure',
      ownerId: 'admin-uid',
      env: { OLLAMA_BASE_URL: fake.url, OLLAMA_MODEL: 'qwen2.5-coder:3b' },
    });

    assert.equal(report.status, 'failed');
    assert.equal(report.executed, false);
    assert.equal(report.ownerId, 'admin-uid');
    assert.ok(report.error);
    assert.match(report.instruction, /checkout/);
  });

  it('stores the real model answer when the call succeeds', async () => {
    let received = '';
    const fake = await fakeServer((url, body) => {
      if (url === '/api/chat') {
        received = body;
        return { payload: JSON.parse(FAKE_MODEL) };
      }
      return { status: 404 };
    });

    const report = await runInstruction({
      instruction: 'Review the payment route',
      ownerId: 'admin-uid',
      env: { OLLAMA_BASE_URL: fake.url, OLLAMA_MODEL: 'qwen2.5-coder:3b' },
    });

    assert.equal(report.status, 'completed');
    assert.match(report.result, /SUMMARY/);
    assert.equal(report.executed, false);
    assert.equal(report.model, 'qwen2.5-coder:3b');
    const request = JSON.parse(received) as { messages: { role: string; content: string }[]; stream: boolean };
    assert.equal(request.stream, false);
    assert.equal(request.messages[0].role, 'system');
    assert.match(request.messages[0].content, /READ-ONLY/);
    assert.match(request.messages[0].content, /Do not state that anything was done/i);
  });
});

/* ── Errors are safe to display ────────────────────────────────────────── */

describe('public errors', () => {
  it('never leaks an upstream URL, token or stack trace', () => {
    const message = publicError(
      Object.assign(new Error('connect ECONNREFUSED http://10.1.2.3:11434 with token abc-secret'), {
        code: 'ECONNREFUSED',
      }),
    );
    assert.ok(!message.includes('10.1.2.3'));
    assert.ok(!message.includes('abc-secret'));
    assert.match(message, /refused the connection/);
  });

  it('distinguishes a timeout and a missing configuration', () => {
    assert.match(publicError({ name: 'AbortError' }), /did not answer in time/);
    assert.match(publicError({ code: 'not_configured' }), /not configured/);
  });
});

/* ── OpenCode ───────────────────────────────────────────────────────────── */

describe('OpenCode probing', () => {
  it('reports real agents and the configured agent from a healthy server', async () => {
    const fake = await fakeServer((url) => {
      if (url.startsWith('/global/health')) {
        return { payload: { healthy: true, version: '1.2.3-test' } };
      }
      if (url.startsWith('/agent')) {
        return {
          payload: [
            {
              name: 'build',
              description: 'Writes code',
              mode: 'primary',
              builtIn: true,
              model: { providerID: 'test-provider', modelID: 'test-model' },
              permission: { edit: 'allow', bash: 'ask' },
            },
            { name: 'plan', description: 'Plans only', mode: 'subagent', builtIn: true },
          ],
        };
      }
      return { status: 404, payload: { error: 'not found' } };
    });

    const status = await probeOpenCode({
      OPENCODE_BASE_URL: fake.url,
      OPENCODE_AGENT: 'build',
      OPENCODE_SERVER_PASSWORD: 'do-not-leak',
    });
    assert.equal(status.state, 'online');
    assert.equal(status.reachable, true);
    assert.equal(status.authenticated, true);
    assert.equal(status.version, '1.2.3-test');
    assert.equal(status.agents.length, 2);
    assert.equal(status.agentAvailable, true);
    assert.equal(status.agents[0]?.name, 'build');
    assert.equal(status.agents[0]?.model, 'test-provider/test-model');
    assert.equal(status.agents[0]?.bashPermission, 'ask');
    assert.ok(!JSON.stringify(status).includes('do-not-leak'));
  });

  it('reports an authentication failure without exposing the password', async () => {
    const fake = await fakeServer((url) =>
      url.startsWith('/global/health') || url.startsWith('/agent')
        ? { status: 401, payload: { error: 'Unauthorized' } }
        : { status: 404 },
    );
    const status = await probeOpenCode({
      OPENCODE_BASE_URL: fake.url,
      OPENCODE_SERVER_PASSWORD: 'never-print-me',
    });
    assert.equal(status.authenticated, false);
    assert.equal(status.state, 'offline');
    assert.match(status.error ?? '', /rejected the server credentials/i);
    assert.ok(!JSON.stringify(status).includes('never-print-me'));
  });

  it('degrades instead of inventing agents when the list is unreadable', async () => {
    const fake = await fakeServer((url) => {
      if (url.startsWith('/global/health')) return { payload: { healthy: true } };
      if (url.startsWith('/agent')) return { payload: { unexpected: true } };
      return { status: 404 };
    });
    const status = await probeOpenCode({ OPENCODE_BASE_URL: fake.url });
    assert.equal(status.state, 'degraded');
    assert.equal(status.agents.length, 0);
    assert.equal(status.agentsAvailable, false);
    assert.match(status.error ?? '', /unsupported shape/i);
  });
});

describe('text limits', () => {
  it('derives a bounded conversation title from the first message', () => {
    const title = titleFromMessage('x'.repeat(400));
    assert.ok(title.length <= 120);
    assert.ok(title.endsWith('…'));
  });
});

/* ── Route-level authorization (static, every route) ───────────────────── */

const ADMIN_ROUTES = [
  'overview',
  'operations',
  'chat',
  'ollama',
  'paperclip',
  'opencode',
  'opencode/task',
  'intelligence/plan',
  'instructions',
  'reports',
  'approvals',
  'system',
];

describe('admin API authorization', () => {
  it('has a route file for every Phase 1 section', () => {
    for (const route of ADMIN_ROUTES) {
      assert.ok(read(`src/app/api/mobile/admin/${route}/route.ts`).length > 0, `${route} missing`);
    }
  });

  it('routes every handler through the server-side admin gate', () => {
    for (const route of ADMIN_ROUTES) {
      const source = read(`src/app/api/mobile/admin/${route}/route.ts`);
      assert.match(source, /adminGate\(request\)/, `${route} must use adminGate`);
      assert.match(source, /if \(gate\.response\) return gate\.response;/, `${route} must refuse non-admins`);
      assert.ok(!/userRole\s*===/.test(source), `${route} must not trust a client role`);
      assert.ok(!/body\.(isAdmin|admin)\b/.test(source), `${route} must not accept a client admin flag`);
    }
  });

  it('the shared gate verifies the Firebase admin identity, not a header flag', () => {
    const gate = read('src/lib/admin-ai/http.ts');
    assert.match(gate, /verifyAdminUid\(request\)/);
    assert.match(gate, /status: 403/);
  });

  it('keeps Ollama and Paperclip addresses server-side', () => {
    const config = read('src/lib/admin-ai/config.ts');
    const publicOllama = config.slice(
      config.indexOf('export function publicOllamaConfig'),
      config.indexOf('export function publicPaperclipConfig'),
    );
    assert.ok(publicOllama.length > 0, 'publicOllamaConfig missing');
    assert.ok(!/baseUrl/.test(publicOllama), 'public Ollama config must not expose the address');
    for (const route of ADMIN_ROUTES) {
      const source = read(`src/app/api/mobile/admin/${route}/route.ts`);
      assert.ok(!source.includes('11434'), `${route} must not hardcode or expose the Ollama port`);
      assert.ok(!/PAPERCLIP_API_URL/.test(source), `${route} must not read Paperclip secrets`);
      assert.ok(!/OPENCODE_SERVER_PASSWORD|OPENCODE_BASE_URL/.test(source), `${route} must not read OpenCode secrets`);
      assert.ok(!/\/session\/[^\n]*\/shell/.test(source), `${route} must not expose an OpenCode shell endpoint`);
    }
  });

  it('records approvals against the reviewed digest and still executes nothing', () => {
    const route = read('src/app/api/mobile/admin/approvals/route.ts');
    assert.match(route, /digest/);
    assert.match(route, /executed: false/);
    assert.match(route, /decideProposal/);
    assert.match(route, /actionDigest/);
    assert.ok(!/\bexec\(|\bspawn\(|\bexecFile\(/.test(route), 'approvals must not execute shell commands');
  });

  it('starts OpenCode only from an approved, digest-matched proposal', () => {
    const route = read('src/app/api/mobile/admin/opencode/route.ts');
    assert.match(route, /proposal\.status !== 'approved'/);
    assert.match(route, /approvedDigest/);
    assert.match(route, /actionDigest/);
    assert.match(route, /startOpenCodeTask/);
    assert.ok(!/prompt_async/.test(route), 'the route must delegate to the bridge');
    assert.ok(!/body\.(task|prompt|command)/.test(route), 'the phone cannot submit a free-text task directly');
  });
});

/* ── PocketBase schema ─────────────────────────────────────────────────── */

describe('admin AI persistence', () => {
  const source = read('src/lib/pocketbase/admin-ai.ts');

  it('defines superuser-only collections for conversations, messages, reports and meta', () => {
    for (const collection of ['admin_ai_conversations', 'admin_ai_messages', 'admin_ai_reports', 'admin_ai_meta']) {
      assert.ok(source.includes(collection), `${collection} missing`);
    }
    assert.match(source, /ensureCollection/);
  });

  it('scopes reads to the admin who owns them', () => {
    assert.match(source, /ownerId = '/);
    assert.match(source, /ownerId: gate|ownerId: doc\.ownerId/);
  });

  it('stores long model output in a JSON column, not a length-capped text field', () => {
    assert.match(source, /type: 'json'/);
    assert.match(source, /data: report/);
  });
});

/* ── Android client wiring ─────────────────────────────────────────────── */

describe('Android Command Centre', () => {
  it('ships every Phase 1 screen', () => {
    const files = readdirSync(`${ROOT}/mobile/app/admin`);
    for (const screen of [
      '_layout.tsx',
      'index.tsx',
      'chat.tsx',
      'ollama.tsx',
      'paperclip.tsx',
      'instructions.tsx',
      'reports.tsx',
      'system.tsx',
      'approvals.tsx',
      'tasks.tsx',
      'task',
    ]) {
      assert.ok(files.includes(screen), `${screen} missing`);
    }
    assert.ok(read('mobile/app/admin/task/[id].tsx').length > 0, 'task detail missing');
  });

  it('guards each screen with the admin gate', () => {
    for (const screen of ['index', 'chat', 'ollama', 'paperclip', 'instructions', 'reports', 'system', 'approvals', 'tasks']) {
      const source = read(`mobile/app/admin/${screen}.tsx`);
      assert.match(source, /<AdminGate>/, `${screen} must use AdminGate`);
    }
    const gate = read('mobile/src/components/admin/kit.tsx');
    assert.match(gate, /userRole/);
    assert.match(gate, /enforced by the Vidnov backend/i);
  });

  it('talks only to the authenticated Vidnov admin API, never to Ollama', () => {
    const api = read('mobile/src/lib/api.ts');
    assert.match(api, /\/api\/mobile\/admin\/chat/);
    assert.match(api, /\/api\/mobile\/admin\/instructions/);
    assert.match(api, /\/api\/mobile\/admin\/opencode/);
    assert.match(api, /\/api\/mobile\/admin\/intelligence\/plan/);
    assert.match(api, /timeoutMs: ADMIN_AI_MODEL_TIMEOUT/);
    for (const screen of ['chat', 'ollama', 'paperclip', 'instructions', 'reports', 'tasks']) {
      const source = read(`mobile/app/admin/${screen}.tsx`);
      assert.ok(!/11434|OLLAMA_BASE_URL|OLLAMA_API_KEY|PAPERCLIP_API_URL/.test(source), `${screen} leaks upstream config`);
    }
  });

  it('offers voice input, speech output, stop-speaking and a typed fallback', () => {
    const voice = read('mobile/src/lib/voice.ts');
    assert.match(voice, /expo-speech-recognition/);
    assert.match(voice, /expo-speech/);
    assert.match(voice, /requestPermissionsAsync/);
    assert.match(voice, /Speech\.stop/);
    assert.match(voice, /You can still type|typing still works/);
    const controls = read('mobile/src/components/admin/voice-controls.tsx');
    assert.match(controls, /STOP SPEAKING/);
    assert.match(controls, /TAP TO SPEAK/);
  });

  it('has the four required Instruction Desk actions', () => {
    const source = read('mobile/app/admin/instructions.tsx');
    for (const label of ['SEND INSTRUCTION', 'COPY INSTRUCTION', 'COPY REPORT', 'NEW TASK']) {
      assert.ok(source.includes(label), `${label} missing`);
    }
    assert.match(source, /Nothing was executed|nothing executed|does not read files/i);
    assert.match(source, /reportToText/);
  });

  it('registers the admin stack and shows the entry only to admins', () => {
    assert.match(read('mobile/app/_layout.tsx'), /name="admin"/);
    const profile = read('mobile/app/(tabs)/profile.tsx');
    assert.match(profile, /role === 'admin'/);
    assert.match(profile, /router\.push\('\/admin'\)/);
  });

  it('declares the speech plugin and a new build number', () => {
    const app = JSON.parse(read('mobile/app.json')) as {
      expo: { version: string; android: { versionCode: number; permissions: string[] }; plugins: unknown[] };
    };
    assert.equal(app.expo.version, '1.6.0');
    assert.equal(app.expo.android.versionCode, 12);
    assert.ok(app.expo.plugins.some((plugin) => String(plugin).includes('expo-speech-recognition')));
    assert.ok(app.expo.android.permissions.includes('android.permission.RECORD_AUDIO'));
  });
});
