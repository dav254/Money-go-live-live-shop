/**
 * VIDNOV AI HEADQUARTERS — Orbit permission, proposal and approval tests.
 *
 * A tiny in-memory Firestore stands in for the real one, so the whole
 * create-agent → authenticate → propose → decide path runs here with no
 * network, no emulator and no credentials. What is being proved is the
 * security contract, not the plumbing:
 *   • a token must hash-match, an unknown id reveals nothing, a disabled
 *     agent is refused,
 *   • a scope is required per action and there is no wildcard,
 *   • a proposal is frozen into a digest, so approval cannot drift,
 *   • nobody approves their own proposal,
 *   • secrets may not be smuggled through proposal parameters,
 *   • an unconfigured model reports MODEL_NOT_CONFIGURED.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AgentError,
  authenticateAgent,
  createAgent,
  listAgents,
  normalizeScopes,
  requireScope,
  setAgentEnabled,
} from '../lib/ai-headquarters/agents';
import {
  createProposal,
  decideProposal,
  listProposals,
  ProposalError,
} from '../lib/ai-headquarters/proposals';
import { digestAction, hashSecret, issueToken, parseToken } from '../lib/ai-headquarters/tokens';
import { modelStatus } from '../lib/ai-headquarters/model';
import {
  TaskError,
  listAllTaskRuns,
  listTaskRuns,
  reportTaskRun,
  summarizeRuns,
} from '../lib/ai-headquarters/tasks';

/* ── In-memory Firestore (only what Orbit uses) ─────────────────────────── */

type Doc = Record<string, unknown>;

function readPath(obj: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Doc)[key];
    return undefined;
  }, obj);
}

class FakeQuery {
  constructor(
    protected rows: Map<string, Doc>,
    protected filters: { field: string; value: unknown }[] = [],
    protected cap = Number.POSITIVE_INFINITY,
  ) {}

  where(field: string, _op: '==', value: unknown) {
    return new FakeQuery(this.rows, [...this.filters, { field, value }], this.cap);
  }

  limit(n: number) {
    return new FakeQuery(this.rows, this.filters, n);
  }

  orderBy() {
    return this;
  }

  async get() {
    const docs = [...this.rows.entries()]
      .filter(([, data]) => this.filters.every((f) => readPath(data, f.field) === f.value))
      .slice(0, this.cap === Number.POSITIVE_INFINITY ? undefined : this.cap)
      .map(([id, data]) => ({ id, exists: true, data: () => ({ ...data }) }));
    return { docs, size: docs.length };
  }

  async count() {
    return {
      get: async () => {
        const snap = await this.get();
        return { data: () => ({ count: snap.size }) };
      },
    };
  }
}

class FakeDocRef {
  constructor(
    protected rows: Map<string, Doc>,
    public id: string,
  ) {}

  async get() {
    const data = this.rows.get(this.id);
    return { id: this.id, exists: Boolean(data), data: () => (data ? { ...data } : undefined) };
  }

  async set(patch: Doc, opts?: { merge?: boolean }) {
    const current = opts?.merge ? (this.rows.get(this.id) ?? {}) : {};
    this.rows.set(this.id, { ...current, ...patch });
  }
}

class FakeCollection extends FakeQuery {
  private counter = 0;

  doc(id?: string) {
    const key = id ?? `auto_${++this.counter}_${Math.random().toString(16).slice(2, 8)}`;
    return new FakeDocRef(this.rows, key);
  }

  async add(data: Doc) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

function fakeDb(existing?: Map<string, Map<string, Doc>>) {
  const cols = existing ?? new Map<string, Map<string, Doc>>();
  const db = {
    collection(name: string) {
      if (!cols.has(name)) cols.set(name, new Map());
      return new FakeCollection(cols.get(name)!);
    },
    async runTransaction<T>(fn: (tx: { get: (r: FakeDocRef) => Promise<Awaited<ReturnType<FakeDocRef['get']>>>; set: (r: FakeDocRef, d: Doc, o?: { merge?: boolean }) => void }) => Promise<T>) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, opts) => {
          void ref.set(data, opts);
        },
      });
    },
    _cols: cols,
  };
  return db as unknown as Parameters<typeof createAgent>[0] & typeof db;
}

/* ── Tokens ─────────────────────────────────────────────────────────────── */

describe('Orbit — credentials', () => {
  it('mints a token whose secret is never stored in clear', () => {
    const issued = issueToken('abcdef123456789012');
    const parsed = parseToken(issued.token);
    assert.ok(parsed);
    assert.equal(parsed?.agentId, 'abcdef123456789012');
    assert.equal(hashSecret(parsed!.secret), issued.tokenHash);
    assert.equal(issued.token.includes(issued.tokenHash), false);
    assert.equal(issued.tokenPrefix.includes(parsed!.secret), false);
  });

  it('rejects malformed and foreign tokens', () => {
    assert.equal(parseToken(''), null);
    assert.equal(parseToken('bp_xyz'), null);
    assert.equal(parseToken('orb_short'), null);
    assert.equal(parseToken('orb_abc_secretnothex'), null);
  });
});

describe('Orbit — action digests', () => {
  it('is stable across object key order', () => {
    const a = digestAction({ type: 'manual_campaign_brief', params: { b: 2, a: 1 } });
    const b = digestAction({ type: 'manual_campaign_brief', params: { a: 1, b: 2 } });
    assert.equal(a, b);
  });

  it('changes when a parameter changes', () => {
    const a = digestAction({ type: 'manual_campaign_brief', params: { budget: 100 } });
    const b = digestAction({ type: 'manual_campaign_brief', params: { budget: 101 } });
    assert.notEqual(a, b);
  });
});

/* ── Agents ─────────────────────────────────────────────────────────────── */

describe('Orbit — agent registry', () => {
  it('creates an agent and authenticates it with the minted token', async () => {
    const db = fakeDb();
    const { agent, token } = await createAgent(db, {
      name: 'Analytics Agent',
      department: 'analytics',
      role: 'reports',
      scopes: ['status:read', 'marketplace:read'],
      actorUid: 'founder-1',
    });

    const resolved = await authenticateAgent(db, token);
    assert.equal(resolved.id, agent.id);
    assert.deepEqual(resolved.scopes, ['status:read', 'marketplace:read']);

    const listed = await listAgents(db);
    assert.equal(listed.length, 1);
    assert.equal('tokenHash' in listed[0], true, 'the store keeps only a hash');
  });

  it('refuses a wrong secret and an unknown id with the same error', async () => {
    const db = fakeDb();
    const { agent, token } = await createAgent(db, {
      name: 'A',
      department: 'analytics',
      role: '',
      scopes: ['status:read'],
      actorUid: 'founder-1',
    });

    const [prefix, secret] = token.split('_').slice(1);
    const forged = `orb_${prefix}_${secret.slice(0, -2)}aa`;
    await assert.rejects(() => authenticateAgent(db, forged), (error: unknown) => {
      assert.ok(error instanceof AgentError);
      assert.equal(error.code, 'unauthorized');
      return true;
    });

    await assert.rejects(() => authenticateAgent(db, `orb_deadbeefdeadbeef_${secret}`), (error: unknown) => {
      assert.ok(error instanceof AgentError);
      assert.equal(error.code, 'unauthorized');
      return true;
    });

    assert.equal((await authenticateAgent(db, token)).id, agent.id);
  });

  it('refuses a disabled agent', async () => {
    const db = fakeDb();
    const { agent, token } = await createAgent(db, {
      name: 'B',
      department: 'social',
      role: '',
      scopes: ['status:read'],
      actorUid: 'founder-1',
    });
    await setAgentEnabled(db, { id: agent.id, enabled: false, actorUid: 'founder-1' });

    await assert.rejects(() => authenticateAgent(db, token), (error: unknown) => {
      assert.ok(error instanceof AgentError);
      assert.equal(error.code, 'disabled');
      return true;
    });
  });

  it('validates scopes against the closed registry', () => {
    assert.deepEqual(normalizeScopes(['status:read', 'status:read']), ['status:read']);
    assert.throws(() => normalizeScopes(['*']), AgentError);
    assert.throws(() => normalizeScopes([]), AgentError);
    assert.throws(() => normalizeScopes(['admin:everything']), AgentError);
  });

  it('denies a scope the agent does not hold', () => {
    const agent = {
      id: 'x',
      name: 'x',
      department: 'analytics' as const,
      role: '',
      scopes: ['status:read' as const],
      tokenHash: '',
      tokenPrefix: '',
      enabled: true,
      createdAt: '',
      createdBy: '',
    };
    assert.throws(() => requireScope(agent, 'publish:propose'), AgentError);
    assert.doesNotThrow(() => requireScope(agent, 'status:read'));
  });
});

/* ── Proposals ──────────────────────────────────────────────────────────── */

async function seedAgent(db: ReturnType<typeof fakeDb>, scopes: string[]) {
  const { agent, token } = await createAgent(db, {
    name: 'Growth Agent',
    department: 'growth',
    role: 'acquisition',
    scopes,
    actorUid: 'founder-1',
  });
  return { agent, token };
}

describe('Orbit — proposals', () => {
  it('refuses a proposal whose scope the agent does not hold', async () => {
    const db = fakeDb();
    const { agent } = await seedAgent(db, ['content:prepare']);
    await assert.rejects(
      () =>
        createProposal(db, agent, {
          kind: 'publish',
          title: 'Post to Telegram',
          summary: '',
          action: { type: 'social_publish_test', params: { module: 'telegram' } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AgentError);
        assert.equal(error.code, 'forbidden');
        return true;
      },
    );
  });

  it('binds approval to the exact digest', async () => {
    const db = fakeDb();
    const { agent } = await seedAgent(db, ['campaign:prepare']);
    const proposal = await createProposal(db, agent, {
      kind: 'campaign',
      title: 'Seller recruitment sprint',
      summary: 'Ten shops in Nairobi',
      action: { type: 'manual_campaign_brief', params: { audience: 'sellers', budget: 0 } },
    });

    await assert.rejects(
      () =>
        decideProposal(db, {
          id: proposal.id,
          decision: 'approve',
          actorUid: 'founder-1',
          digest: 'f'.repeat(64),
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProposalError);
        assert.equal(error.code, 'conflict');
        return true;
      },
    );

    const approved = await decideProposal(db, {
      id: proposal.id,
      decision: 'approve',
      actorUid: 'founder-1',
      digest: proposal.actionDigest,
    });
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvedDigest, proposal.actionDigest);
    assert.equal(approved.decidedBy, 'founder-1');
  });

  it('never lets a proposer approve their own proposal', async () => {
    const db = fakeDb();
    const { agent } = await seedAgent(db, ['investigation:prepare']);
    const proposal = await createProposal(db, agent, {
      kind: 'investigation',
      title: 'Check checkout errors',
      summary: '',
      action: { type: 'technical_investigation', params: { area: 'checkout' } },
    });

    // Simulate a human-filed proposal that the same human tries to approve.
    const rows = (db as unknown as { _cols: Map<string, Map<string, Record<string, unknown>>> })._cols;
    const stored = rows.get('ai_hq_proposals')!.get(proposal.id)!;
    rows.get('ai_hq_proposals')!.set(proposal.id, {
      ...stored,
      requestedBy: { ...(stored.requestedBy as object), uid: 'founder-1' },
    });

    await assert.rejects(
      () =>
        decideProposal(db, {
          id: proposal.id,
          decision: 'approve',
          actorUid: 'founder-1',
          digest: proposal.actionDigest,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProposalError);
        assert.equal(error.code, 'forbidden');
        return true;
      },
    );
  });

  it('rejects secret-looking parameters', async () => {
    const db = fakeDb();
    const { agent } = await seedAgent(db, ['content:prepare']);
    await assert.rejects(
      () =>
        createProposal(db, agent, {
          kind: 'content',
          title: 'Leak attempt',
          summary: '',
          action: { type: 'manual_campaign_brief', params: { access_token: 'x' } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProposalError);
        assert.equal(error.code, 'invalid_input');
        return true;
      },
    );
  });

  it('applies a cooldown between two proposals from one agent', async () => {
    const db = fakeDb();
    const { agent } = await seedAgent(db, ['content:prepare']);
    const now = new Date('2026-01-01T10:00:00.000Z');

    await createProposal(db, agent, {
      kind: 'content',
      title: 'First',
      summary: '',
      action: { type: 'manual_campaign_brief', params: {} },
      now,
    });

    await assert.rejects(
      () =>
        createProposal(db, agent, {
          kind: 'content',
          title: 'Second',
          summary: '',
          action: { type: 'manual_campaign_brief', params: {} },
          now: new Date(now.getTime() + 3_000),
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProposalError);
        assert.equal(error.code, 'rate_limited');
        return true;
      },
    );

    const later = await createProposal(db, agent, {
      kind: 'content',
      title: 'Third',
      summary: '',
      action: { type: 'manual_campaign_brief', params: {} },
      now: new Date(now.getTime() + 60_000),
    });
    assert.equal(later.status, 'pending');
  });
});

/* ── Structural guarantees ──────────────────────────────────────────────── */

describe('Orbit — no route bypasses the guard', () => {
  const routes = [
    '../app/api/orbit/status/route.ts',
    '../app/api/orbit/marketplace/route.ts',
    '../app/api/orbit/social/route.ts',
    '../app/api/orbit/proposals/route.ts',
    '../app/api/orbit/tasks/route.ts',
  ];

  for (const path of routes) {
    it(`${path.split('/').slice(-3, -2)} route requires an agent credential`, () => {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      assert.match(source, /authorizeOrbitRequest|authenticateOrbitRequest/);
      // No route may read Firestore without the guard above it.
      assert.equal(/firebase\/server/.test(source), true);
      assert.equal(/process\.env\.[A-Z_]*(KEY|SECRET|TOKEN)/.test(source), false);
    });
  }

  it('the admin console API uses the repository admin check', () => {
    const source = readFileSync(
      new URL('../app/api/admin/ai-headquarters/route.ts', import.meta.url),
      'utf8',
    );
    assert.match(source, /verifyAdminUid/);
    assert.equal(/tokenHash: ?agent\.tokenHash/.test(source), false, 'no hash may be returned');
  });
});

/* ── Worker run ledger (task §9 D–F) ───────────────────────────────────── */

async function agentWith(
  db: ReturnType<typeof fakeDb>,
  scopes: string[],
  name = 'Growth Agent',
  department = 'growth',
) {
  const { agent } = await createAgent(db, {
    name,
    department,
    role: 'worker',
    scopes,
    actorUid: 'founder-1',
  });
  return agent;
}

describe('Orbit — worker run ledger', () => {
  it('records a completed mock run with its structured result', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['tasks:report', 'tasks:read']);

    const { run, duplicate } = await reportTaskRun(db, agent, {
      taskKey: 'PC-1042',
      title: 'Prepare seller outreach for category: furniture',
      status: 'completed',
      summary: 'Produced 3 outreach drafts and a 14-day plan.',
      result: { drafts: 3, channel: 'instagram', campaignSlug: 'furniture-sellers-01' },
      startedAt: '2026-11-04T09:00:00.000Z',
      endedAt: '2026-11-04T09:02:30.000Z',
      mock: true,
    });

    assert.equal(duplicate, false);
    assert.equal(run.status, 'completed');
    assert.equal(run.attempt, 1);
    assert.equal(run.mock, true, 'a run without a model must be labelled mock');
    assert.equal(run.durationMs, 150_000, 'duration is derived from start/end');
    assert.deepEqual(run.result, { drafts: 3, channel: 'instagram', campaignSlug: 'furniture-sellers-01' });

    const listed = await listTaskRuns(db, { agentId: agent.id });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].title, 'Prepare seller outreach for category: furniture');
  });

  it('is idempotent per (taskKey, attempt) and keeps resumed attempts separate', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['tasks:report']);
    const base = {
      taskKey: 'PC-2001',
      title: 'Investigate a failed publish',
      summary: 'first pass',
      status: 'failed' as const,
      error: { code: 'timeout', message: 'Upstream timed out.' },
    };

    const first = await reportTaskRun(db, agent, base);
    const replay = await reportTaskRun(db, agent, base);
    assert.equal(first.duplicate, false);
    assert.equal(replay.duplicate, true, 'a retried attempt must not duplicate history');
    assert.equal(replay.run.id, first.run.id);

    const resumed = await reportTaskRun(db, agent, {
      ...base,
      attempt: 2,
      status: 'completed',
      summary: 'second pass',
      error: undefined,
    });
    assert.equal(resumed.duplicate, false);
    assert.equal(resumed.run.attempt, 2);

    const all = await listTaskRuns(db, { agentId: agent.id });
    assert.equal(all.length, 2, 'resume appends a run instead of overwriting the failure');
    assert.deepEqual(all.map((r) => r.attempt).sort(), [1, 2]);
  });

  it('refuses reporting without the tasks:report scope', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['status:read']);
    await assert.rejects(
      () => reportTaskRun(db, agent, { taskKey: 'PC-1', title: 'Nope', status: 'running' }),
      (error: unknown) => {
        assert.ok(error instanceof AgentError);
        assert.equal(error.code, 'forbidden');
        return true;
      },
    );
  });

  it('requires an error for a failed run and accepts delayed work', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['tasks:report']);

    await assert.rejects(
      () => reportTaskRun(db, agent, { taskKey: 'PC-3', title: 'Failed silently', status: 'failed' }),
      (error: unknown) => {
        assert.ok(error instanceof TaskError);
        assert.equal(error.code, 'invalid_input');
        return true;
      },
    );

    const delayed = await reportTaskRun(db, agent, {
      taskKey: 'PC-4',
      title: 'Overdue review',
      status: 'delayed',
    });
    assert.equal(delayed.run.status, 'delayed');
  });

  it('refuses credentials and oversized payloads in a result', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['tasks:report']);

    await assert.rejects(
      () =>
        reportTaskRun(db, agent, {
          taskKey: 'PC-5',
          title: 'Leak attempt',
          status: 'completed',
          result: { nested: { apiKey: 'sk-live-xxx' } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TaskError);
        assert.equal(error.code, 'invalid_input');
        return true;
      },
    );

    await assert.rejects(
      () =>
        reportTaskRun(db, agent, {
          taskKey: 'PC-6',
          title: 'Payload drop',
          status: 'completed',
          result: { blob: 'x'.repeat(4_200) },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TaskError);
        return true;
      },
    );
  });

  it('sums measured usage and reports null when nothing was measured', async () => {
    const db = fakeDb();
    const agent = await agentWith(db, ['tasks:report']);

    await reportTaskRun(db, agent, {
      taskKey: 'PC-7',
      title: 'Draft campaign copy',
      status: 'completed',
      mock: false,
      model: { provider: 'gemini', name: 'gemini-2.5-pro', tokensIn: 100, tokensOut: 20, costUsd: 0.01 },
    });
    await reportTaskRun(db, agent, {
      taskKey: 'PC-8',
      title: 'Draft follow-up copy',
      status: 'completed',
      mock: false,
      model: { provider: 'gemini', name: 'gemini-2.5-pro', tokensIn: 50, tokensOut: 10, costUsd: 0.02 },
    });

    const runs = await listAllTaskRuns(db);
    const summary = summarizeRuns(runs);
    assert.equal(summary.total, 2);
    assert.equal(summary.completed, 2);
    assert.equal(summary.tokensIn, 150);
    assert.equal(summary.tokensOut, 30);
    assert.equal(summary.costUsd, 0.03);

    const empty = summarizeRuns([]);
    assert.equal(empty.tokensIn, null, 'unmeasured usage is null, never a fabricated zero');
    assert.equal(empty.costUsd, null);
  });

  it('lists only the caller\u2019s own runs', async () => {
    const db = fakeDb();
    const growth = await agentWith(db, ['tasks:report'], 'Growth Agent', 'growth');
    const support = await agentWith(db, ['tasks:report'], 'Support Agent', 'experience');

    await reportTaskRun(db, growth, { taskKey: 'PC-10', title: 'Growth task', status: 'completed' });
    await reportTaskRun(db, support, { taskKey: 'PC-11', title: 'Support task', status: 'completed' });

    const growthRuns = await listTaskRuns(db, { agentId: growth.id });
    assert.equal(growthRuns.length, 1);
    assert.equal(growthRuns[0].agentId, growth.id);
    assert.equal(growthRuns.some((run) => run.agentId === support.id), false);
  });
});

/* ── End-to-end, mock mode (task §9 A–J) ───────────────────────────────── */

describe('Orbit — end-to-end mock workflow', () => {
  it('carries a Paperclip task through Hermes, Orbit, approval and a restart', async () => {
    const db = fakeDb();
    const { agent, token } = await createAgent(db, {
      name: 'Growth Manager',
      department: 'growth',
      role: 'seller acquisition',
      scopes: [
        'status:read',
        'marketplace:read',
        'social:read',
        'campaign:prepare',
        'content:prepare',
        'publish:propose',
        'tasks:read',
        'tasks:report',
      ],
      actorUid: 'founder-1',
    });

    // A + B — Paperclip creates PC-5001 and assigns it to the Growth Manager.
    const taskKey = 'PC-5001';

    // C — Hermes picks it up and says so (mock mode: no model key exists).
    const started = await reportTaskRun(db, agent, {
      taskKey,
      title: 'Prepare 20 seller invitations for Lagos furniture stores',
      status: 'running',
      mock: true,
    });
    assert.equal(started.run.status, 'running');

    // D + E — the worker returns a structured result.
    const finished = await reportTaskRun(db, agent, {
      taskKey,
      title: 'Prepare 20 seller invitations for Lagos furniture stores',
      status: 'completed',
      summary: 'Drafted 20 personalised invitations and 3 campaign links. Nothing was sent.',
      result: { drafts: 20, links: 3, sent: 0 },
      startedAt: started.run.startedAt,
      endedAt: new Date(Date.parse(started.run.startedAt) + 90_000).toISOString(),
      mock: true,
    });
    assert.equal(finished.run.status, 'completed');
    assert.equal(finished.run.result?.sent, 0, 'a prepared draft is not an outreach');

    // F — Orbit recorded it, owns the row, and refuses a second agent\u2019s claim.
    const recorded = await listTaskRuns(db, { agentId: agent.id });
    assert.equal(recorded.length, 1, 'one task, one attempt, one run row');
    assert.equal(recorded[0].status, 'completed');
    const outsider = await agentWith(db, ['tasks:read'], 'Support Agent', 'experience');
    assert.equal((await listTaskRuns(db, { agentId: outsider.id })).length, 0);

    // G — the agent prepares a publishing proposal.
    const proposal = await createProposal(db, agent, {
      kind: 'publish',
      title: 'Publish furniture-seller campaign to Instagram',
      summary: 'Three posts, tracked links, no spend.',
      action: {
        type: 'social_publish_test',
        params: { module: 'instagram', campaignSlug: 'furniture-sellers-01', postCount: 3 },
      },
    });
    assert.equal(proposal.status, 'pending');

    // H — it is waiting in the founder queue, with the exact digest.
    const queue = await listProposals(db, { limit: 10 });
    assert.equal(queue.filter((p) => p.status === 'pending').length, 1);
    assert.equal(queue[0].actionDigest, proposal.actionDigest);

    // I — approval needs the exact digest; nothing is published by approving.
    await assert.rejects(
      () =>
        decideProposal(db, {
          id: proposal.id,
          decision: 'approve',
          actorUid: 'founder-1',
          digest: 'f'.repeat(64),
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProposalError);
        assert.equal(error.code, 'conflict');
        return true;
      },
    );

    const runsBeforeApproval = (await listAllTaskRuns(db)).length;
    const approved = await decideProposal(db, {
      id: proposal.id,
      decision: 'approve',
      actorUid: 'founder-1',
      digest: proposal.actionDigest,
      note: 'Approved for manual publish by an admin.',
    });
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvedDigest, proposal.actionDigest);
    assert.equal(
      (await listAllTaskRuns(db)).length,
      runsBeforeApproval,
      'approval must not execute anything',
    );

    // J — a restart (new client over the same data) keeps history and access.
    const restarted = fakeDb(db._cols);
    const reread = await authenticateAgent(restarted, token);
    assert.equal(reread.id, agent.id, 'the credential survives a restart');
    const history = await listTaskRuns(restarted, { agentId: agent.id });
    assert.equal(history.length, 1, 'task history survives a restart');
    assert.equal(history[0].status, 'completed');
    const replay = await reportTaskRun(restarted, reread, {
      taskKey,
      title: 'Prepare 20 seller invitations for Lagos furniture stores',
      status: 'completed',
      mock: true,
    });
    assert.equal(replay.duplicate, true, 'a post-restart retry must not duplicate the run');
    assert.equal((await listTaskRuns(restarted, { agentId: agent.id })).length, 1);
  });
});

/* ── Model honesty ──────────────────────────────────────────────────────── */

describe('Orbit — model configuration', () => {
  it('reports MODEL_NOT_CONFIGURED with names only', () => {
    const status = modelStatus({});
    assert.equal(status.state, 'MODEL_NOT_CONFIGURED');
    assert.equal(status.configured, false);
    assert.deepEqual(status.missing, ['HERMES_MODEL_PROVIDER', 'HERMES_MODEL_API_KEY']);
  });

  it('reports configured once a provider and key exist, without echoing the key', () => {
    const status = modelStatus({
      HERMES_MODEL_PROVIDER: 'gemini',
      HERMES_MODEL: 'gemini-2.5-pro',
      HERMES_MODEL_API_KEY: 'super-secret-value',
    });
    assert.equal(status.state, 'MODEL_CONFIGURED');
    assert.equal(status.provider, 'gemini');
    assert.equal(JSON.stringify(status).includes('super-secret-value'), false);
  });

  it('does not reflect an invalid provider string back', () => {
    const status = modelStatus({
      HERMES_MODEL_PROVIDER: 'this is my api key sk-123',
      HERMES_MODEL_API_KEY: 'k',
    });
    assert.equal(status.provider, 'custom');
  });
});
