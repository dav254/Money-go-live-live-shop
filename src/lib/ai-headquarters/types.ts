/**
 * VIDNOV AI HEADQUARTERS — shared vocabulary (pure module).
 *
 * Paperclip owns the company: departments, agents, tasks, budgets.
 * Hermes executes the work. THIS module is Orbit — the only door an agent may
 * use to touch Vidnov, and the only place Vidnov decides what an agent is
 * allowed to see or propose.
 *
 * Design rules encoded here (task §D/§G):
 *   • every capability is an explicit scope string — there is no wildcard,
 *   • an agent can only READ, INVESTIGATE, ANALYZE, RECOMMEND and PREPARE,
 *   • anything irreversible is a PROPOSAL for the founder, never an action,
 *   • approvals are bound to a digest of the exact action + parameters.
 *
 * Pure: no I/O, no Firestore, no network. Safe for tests.
 */

/* ── Departments (task §B) ───────────────────────────────────────────────── */

export const DEPARTMENTS = [
  {
    id: 'executive',
    label: 'Executive Office',
    responsibility: 'Sets priorities, delegates work, reports to the founder, owns nothing operational itself.',
    reportsTo: 'founder',
  },
  {
    id: 'growth',
    label: 'Growth and Seller Acquisition',
    responsibility: 'Finds seller prospects, prepares outreach and acquisition campaigns, tracks seller sign-ups.',
    reportsTo: 'executive',
  },
  {
    id: 'customer',
    label: 'Customer Acquisition',
    responsibility: 'Buyer-facing campaigns, discovery funnels, retention ideas — all as proposals.',
    reportsTo: 'executive',
  },
  {
    id: 'social',
    label: 'Social Media and Distribution',
    responsibility: 'Prepares platform-specific content and campaigns; never publishes without approval.',
    reportsTo: 'executive',
  },
  {
    id: 'research',
    label: 'Market Research',
    responsibility: 'Reads public market signals, competitor pricing and category demand; produces briefs.',
    reportsTo: 'executive',
  },
  {
    id: 'engineering',
    label: 'Development and Engineering',
    responsibility: 'Investigates errors, prepares fixes and test plans, reports deploy risk. No deploy rights.',
    reportsTo: 'executive',
  },
  {
    id: 'analytics',
    label: 'Analytics and Reporting',
    responsibility: 'Reads marketplace and distribution aggregates, produces scheduled reports.',
    reportsTo: 'executive',
  },
  {
    id: 'experience',
    label: 'Customer Experience',
    responsibility: 'Reviews support themes, prepares reply drafts and FAQ updates for human approval.',
    reportsTo: 'executive',
  },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]['id'];

export function isDepartmentId(value: unknown): value is DepartmentId {
  return typeof value === 'string' && DEPARTMENTS.some((d) => d.id === value);
}

/* ── Scopes — the entire permission surface ──────────────────────────────── */

/**
 * A scope is a single, named capability. Adding cron jobs, new platforms or
 * new agents never widens an existing token: a token holds exactly these
 * strings and nothing else.
 */
export const SCOPES = [
  'status:read',
  'marketplace:read',
  'social:read',
  'campaign:prepare',
  'content:prepare',
  'investigation:prepare',
  'publish:propose',
  /** Read back the execution runs this agent reported. */
  'tasks:read',
  /**
   * Report task execution (start, result, failure, delay). This is the only
   * scope whose write target is Vidnov's own ledger, and it can write nothing
   * but the agent's own run rows.
   */
  'tasks:report',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

/** Human labels for the console. */
export const SCOPE_LABELS: Record<Scope, string> = {
  'status:read': 'Read system status',
  'marketplace:read': 'Read marketplace aggregates',
  'social:read': 'Read Social Engine readiness',
  'campaign:prepare': 'Prepare campaigns',
  'content:prepare': 'Prepare social content',
  'investigation:prepare': 'Prepare technical investigations',
  'publish:propose': 'Propose publishing for approval',
  'tasks:read': 'Read own task runs',
  'tasks:report': 'Report task runs and results',
};

/**
 * What an agent may ever do with a scope: nothing here writes to a business
 * record. `prepare` means "produce a proposal", `read` means "receive safe
 * aggregates" — publishing, spending, deploying and deleting are absent by
 * construction, not hidden behind a flag.
 */
export const SCOPE_KINDS: Record<Scope, 'read' | 'prepare' | 'report'> = {
  'status:read': 'read',
  'marketplace:read': 'read',
  'social:read': 'read',
  'campaign:prepare': 'prepare',
  'content:prepare': 'prepare',
  'investigation:prepare': 'prepare',
  'publish:propose': 'prepare',
  'tasks:read': 'read',
  'tasks:report': 'report',
};

/* ── Proposals (task §G) ─────────────────────────────────────────────────── */

/**
 * A proposal is the ONLY output of a `prepare` scope. It never executes
 * anything: approval records the founder's decision, and a human still runs
 * the action through its normal, already-guarded route.
 */
export const PROPOSAL_KINDS = ['campaign', 'content', 'investigation', 'publish'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export function isProposalKind(value: unknown): value is ProposalKind {
  return typeof value === 'string' && (PROPOSAL_KINDS as readonly string[]).includes(value);
}

/** The scope a kind demands before it can even be created. */
export const PROPOSAL_SCOPE: Record<ProposalKind, Scope> = {
  campaign: 'campaign:prepare',
  content: 'content:prepare',
  investigation: 'investigation:prepare',
  publish: 'publish:propose',
};

/**
 * The only action types a proposal may name. Anything else is rejected at
 * creation — an agent cannot describe an action Vidnov has no route for.
 */
export const PROPOSAL_ACTIONS = [
  /** A social post to be run by an admin through the existing Social Engine. */
  'social_publish_test',
  /** A growth-posts campaign to be composed/approved by an admin. */
  'growth_post_campaign',
  /** Operator notes for a campaign the founder may run manually. */
  'manual_campaign_brief',
  /** A technical investigation brief for the engineering agent/owner. */
  'technical_investigation',
  /** A coding task for OpenCode, executable only after founder approval. */
  'opencode_task',
] as const;
export type ProposalActionType = (typeof PROPOSAL_ACTIONS)[number];

export function isProposalAction(value: unknown): value is ProposalActionType {
  return typeof value === 'string' && (PROPOSAL_ACTIONS as readonly string[]).includes(value);
}

export const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/* ── Limits ──────────────────────────────────────────────────────────────── */

export const HQ_LIMITS = {
  /** Proposals one agent may create per rolling day. */
  proposalsPerAgentPerDay: 30,
  /** Seconds between two proposal creations by the same agent. */
  proposalCooldownSeconds: 10,
  /** Bounded scan for a proposal list. */
  listLimit: 50,
  /** Max serialized action size — a proposal is a brief, not a payload drop. */
  actionBytesMax: 8_000,
  /** Max title/summary lengths. */
  titleMax: 160,
  summaryMax: 2_000,
  /** Task runs one agent may report per rolling day (a runaway worker cap). */
  taskRunsPerAgentPerDay: 400,
  /** Max serialized result size for one run. */
  resultBytesMax: 4_000,
  /** Bounded scan for a task-run list. */
  taskListLimit: 50,
} as const;

/* ── Records ─────────────────────────────────────────────────────────────── */

export interface AgentRecord {
  id: string;
  name: string;
  department: DepartmentId;
  role: string;
  scopes: Scope[];
  /** SHA-256 of the secret half of the token. The token itself is never stored. */
  tokenHash: string;
  /** Display-only prefix, so an admin can tell two tokens apart. */
  tokenPrefix: string;
  enabled: boolean;
  createdAt: string;
  createdBy: string;
  lastSeenAt?: string;
  disabledAt?: string;
}

export interface ProposalAction {
  type: ProposalActionType;
  params: Record<string, unknown>;
}

export interface ProposalRecord {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  action: ProposalAction;
  /** SHA-256 of the action, computed server-side at creation. */
  actionDigest: string;
  requestedBy: {
    agentId: string;
    name: string;
    department: DepartmentId;
    /** Present only when a human filed it. Agents have no uid. */
    uid?: string;
  };
  status: ProposalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  /** The digest that was actually approved — must equal actionDigest. */
  approvedDigest?: string;
}

/* ── Task runs — the worker ledger (task §9 F) ───────────────────────────── */

/**
 * How a run ended. `delayed` exists because "it is late" is information the
 * founder needs before it becomes a failure, and `running` because a long task
 * must be visible while it is still in flight.
 */
export const TASK_STATUSES = ['running', 'completed', 'failed', 'delayed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/**
 * One execution of one task, as reported by the worker.
 *
 * Deliberately NOT a task manager: Paperclip owns assignment, priority and
 * deadlines. This ledger exists so Vidnov can answer "which machine identity
 * did what, with which result, under whose permission, and did it survive a
 * restart" — and so a founder dashboard can exist without reading Paperclip's
 * database directly.
 */
export interface TaskRunRecord {
  id: string;
  /** Paperclip's task identifier. The pair (taskKey, attempt) is unique. */
  taskKey: string;
  /** 1 for the first execution; a resume after a crash is attempt + 1. */
  attempt: number;
  agentId: string;
  agentName: string;
  department: DepartmentId;
  title: string;
  status: TaskStatus;
  /** Human-readable outcome. Never a place for secrets. */
  summary?: string;
  /** Small structured result (ids, counts, links) — bounded and key-filtered. */
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  /** Token/cost accounting when a real model produced the run. */
  model?: {
    provider: string;
    name: string;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  };
  /** Declared by the worker: true when no real model produced this run. */
  mock: boolean;
  createdAt: string;
}

/** Roll-up used by the founder dashboard. `null` means "not measurable". */
export interface TaskSummary {
  total: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  cancelled: number;
  /** Runs produced without a real model — shown so mock is never mistaken for AI. */
  mockRuns: number;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
}

/** One line of the headquarters audit trail. */
export interface HqAuditEntry {
  action:
    | 'agent_created'
    | 'agent_disabled'
    | 'agent_enabled'
    | 'proposal_created'
    | 'proposal_decided'
    | 'task_reported'
    | 'request_denied';
  actor: string;
  agentId?: string;
  proposalId?: string;
  taskKey?: string;
  outcome: 'ok' | 'refused' | 'failed';
  note?: string;
  at: string;
}
