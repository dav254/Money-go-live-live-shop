/**
 * ADMIN AI — OpenCode bridge (server only).
 *
 * The Android app never receives the OpenCode URL, basic-auth password,
 * workspace path or provider credentials. Every call goes through Vidnov's
 * authenticated admin routes. This module talks only to the documented
 * OpenCode server API:
 *
 *   GET  /global/health
 *   GET  /agent
 *   GET  /session/status
 *   POST /session
 *   POST /session/:id/prompt_async
 *   GET  /session/:id/message
 *   GET  /session/:id/todo
 *   GET  /session/:id/diff
 *   POST /session/:id/abort
 *
 * Deliberately absent: `/session/:id/shell` and any arbitrary command route.
 * The phone can create an approved coding task, watch it and stop it; it
 * cannot ask the VPS to run a shell command.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  DEFAULT_OPENCODE_AGENT,
  OPENCODE_TASK_TIMEOUT_MS,
  OPENCODE_TIMEOUT_MS,
  openCodeConfig,
  type OpenCodeConfig,
} from './config';
import { cleanText, publicError, stateFromProbe, type CheckState } from './validate';

export const OPENCODE_TASKS_COLLECTION = 'opencode_tasks';

export type OpenCodeTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export class OpenCodeError extends Error {
  constructor(
    readonly code:
      | 'not_configured'
      | 'unreachable'
      | 'timeout'
      | 'unauthorized'
      | 'bad_response'
      | 'rejected',
    message: string,
  ) {
    super(message);
    this.name = 'OpenCodeError';
  }
}

export interface OpenCodeAgent {
  name: string;
  description: string | null;
  mode: string;
  builtIn: boolean;
  model: string | null;
  temperature: number | null;
  editPermission: string | null;
  bashPermission: 'ask' | 'allow' | 'deny' | 'mixed' | null;
}

export interface OpenCodeStatus {
  configured: boolean;
  explicit: boolean;
  state: CheckState;
  reachable: boolean;
  authenticated: boolean;
  version: string | null;
  latencyMs: number | null;
  checkedAt: string;
  agent: string;
  model: string | null;
  workspaceConfigured: boolean;
  hasPassword: boolean;
  agents: OpenCodeAgent[];
  agentsAvailable: boolean;
  agentAvailable: boolean;
  detail: string;
  error: string | null;
}

export interface OpenCodeTaskRecord {
  id: string;
  proposalId: string;
  sessionId: string;
  title: string;
  prompt: string;
  agent: string;
  model: string | null;
  status: OpenCodeTaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dispatchedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  progress?: { completed: number; total: number } | null;
  changedFileCount?: number;
}

export interface OpenCodeTodo {
  id: string;
  content: string;
  status: string;
  priority: string;
}

export interface OpenCodeTool {
  tool: string;
  status: string;
  title: string | null;
  command: string | null;
  output: string | null;
  error: string | null;
}

export interface OpenCodeTestResult {
  command: string;
  status: string;
  output: string;
}

export interface OpenCodeChangedFile {
  file: string;
  additions: number;
  deletions: number;
}

export interface OpenCodeMessage {
  id: string;
  role: string;
  text: string;
  createdAt: string | null;
  error: string | null;
}

export interface OpenCodeTaskDetail {
  task: OpenCodeTaskRecord;
  sessionStatus: 'idle' | 'busy' | 'retry' | 'unknown';
  output: string;
  changedFiles: OpenCodeChangedFile[];
  tests: OpenCodeTestResult[];
  tools: OpenCodeTool[];
  todos: OpenCodeTodo[];
  messages: OpenCodeMessage[];
  error: string | null;
  syncError: string | null;
}

type Loose = Record<string, unknown>;

function stringValue(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

function authHeaders(config: OpenCodeConfig): Record<string, string> {
  if (!config.password) return {};
  const encoded = Buffer.from(`${config.username}:${config.password}`, 'utf8').toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

function endpoint(config: OpenCodeConfig, path: string): string {
  const url = new URL(`${config.baseUrl}${path}`);
  // OpenCode's documented instance scoping. The directory never reaches the
  // phone; it is read from the server environment.
  if (config.directory) url.searchParams.set('directory', config.directory);
  return url.toString();
}

async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new OpenCodeError('timeout', 'OpenCode did not answer in time.');
    }
    throw new OpenCodeError('unreachable', 'OpenCode could not be reached from the Vidnov server.');
  } finally {
    clearTimeout(timer);
  }
}

async function request(
  config: OpenCodeConfig,
  path: string,
  init: RequestInit = {},
  timeoutMs = OPENCODE_TIMEOUT_MS,
): Promise<{ status: number; body: unknown }> {
  const response = await timedFetch(
    endpoint(config, path),
    {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(config),
        ...(init.headers ?? {}),
      },
    },
    timeoutMs,
  );

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new OpenCodeError(
        'unauthorized',
        'OpenCode rejected the server credentials. Check OPENCODE_SERVER_PASSWORD.',
      );
    }
    throw new OpenCodeError(
      'rejected',
      `OpenCode answered HTTP ${response.status} for ${path}.`,
    );
  }

  return { status: response.status, body };
}

function mapAgent(raw: unknown): OpenCodeAgent | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Loose;
  const name = stringValue(record.name, 120);
  if (!name) return null;
  const model = record.model && typeof record.model === 'object' ? (record.model as Loose) : null;
  const permission =
    record.permission && typeof record.permission === 'object' ? (record.permission as Loose) : null;
  const bash = permission?.bash;
  const bashPermission =
    bash === 'ask' || bash === 'allow' || bash === 'deny'
      ? bash
      : bash && typeof bash === 'object'
        ? 'mixed'
        : null;
  return {
    name,
    description: stringValue(record.description, 400),
    mode: stringValue(record.mode, 30) ?? 'unknown',
    builtIn: record.builtIn === true,
    model:
      model && stringValue(model.providerID, 80) && stringValue(model.modelID, 100)
        ? `${stringValue(model.providerID, 80)}/${stringValue(model.modelID, 100)}`
        : null,
    temperature: numberValue(record.temperature),
    editPermission: stringValue(permission?.edit, 20),
    bashPermission,
  };
}

function normalizeAgents(payload: unknown): OpenCodeAgent[] | null {
  if (!Array.isArray(payload)) return null;
  return payload
    .map(mapAgent)
    .filter((agent): agent is OpenCodeAgent => Boolean(agent));
}

/**
 * Health and agents are probed independently. A reachable server with an
 * unreadable agent list is DEGRADED, not ONLINE: the founder cannot start a
 * task if the app cannot name an agent.
 */
export async function probeOpenCode(
  env: Record<string, string | undefined> = process.env,
): Promise<OpenCodeStatus> {
  const checkedAt = new Date().toISOString();
  const config = openCodeConfig(env);

  if (!config) {
    return {
      configured: false,
      explicit: false,
      state: 'unknown',
      reachable: false,
      authenticated: false,
      version: null,
      latencyMs: null,
      checkedAt,
      agent: DEFAULT_OPENCODE_AGENT,
      model: null,
      workspaceConfigured: false,
      hasPassword: false,
      agents: [],
      agentsAvailable: false,
      agentAvailable: false,
      detail: 'OpenCode is not configured on this server (OPENCODE_BASE_URL is invalid).',
      error: null,
    };
  }

  const started = Date.now();
  const [healthResult, agentsResult] = await Promise.allSettled([
    request(config, '/global/health', { method: 'GET' }),
    request(config, '/agent', { method: 'GET' }),
  ]);

  let reachable = false;
  let authenticated = false;
  let version: string | null = null;
  let error: string | null = null;

  if (healthResult.status === 'fulfilled') {
    reachable = true;
    authenticated = true;
    const body = healthResult.value.body as Loose | null;
    version = stringValue(body?.version, 40);
    if (body?.healthy !== true) error = 'OpenCode reports that it is not healthy.';
  } else {
    const reason = healthResult.reason as OpenCodeError;
    reachable = reason?.code === 'unauthorized' || reason?.code === 'rejected';
    error = publicError(reason);
  }

  let agents: OpenCodeAgent[] = [];
  let agentsAvailable = false;
  if (agentsResult.status === 'fulfilled') {
    const parsed = normalizeAgents(agentsResult.value.body);
    if (parsed !== null) {
      agents = parsed;
      agentsAvailable = true;
    } else if (!error) {
      error = 'OpenCode answered, but the agent list had an unsupported shape.';
    }
  } else if (!error) {
    error = publicError(agentsResult.reason);
  }

  agents.sort((a, b) => a.name.localeCompare(b.name));
  const agentAvailable = agents.some((agent) => agent.name === config.agent);

  return {
    configured: true,
    explicit: config.explicit,
    hasPassword: Boolean(config.password),
    workspaceConfigured: Boolean(config.directory),
    agent: config.agent,
    model: config.model ? `${config.model.providerID}/${config.model.modelID}` : null,
    state: stateFromProbe({
      configured: true,
      reachable: reachable && authenticated,
      degraded: reachable && authenticated && !agentsAvailable,
    }),
    reachable,
    authenticated,
    version,
    latencyMs: Date.now() - started,
    checkedAt,
    agents,
    agentsAvailable,
    agentAvailable,
    detail: !reachable
      ? 'OpenCode could not be reached from the Vidnov server.'
      : !authenticated
        ? 'OpenCode rejected the server credentials.'
        : agentsAvailable
          ? `${agents.length} agent${agents.length === 1 ? '' : 's'} reported.`
          : 'OpenCode answered, but no agent list was available.',
    error,
  };
}

function taskFromDoc(id: string, data: Loose): OpenCodeTaskRecord {
  const statusRaw = stringValue(data.status, 30);
  const status: OpenCodeTaskStatus =
    statusRaw === 'running' || statusRaw === 'completed' || statusRaw === 'failed' || statusRaw === 'cancelled'
      ? statusRaw
      : 'queued';
  return {
    id,
    proposalId: stringValue(data.proposalId, 120) ?? '',
    sessionId: stringValue(data.sessionId, 200) ?? '',
    title: stringValue(data.title, 200) ?? 'OpenCode task',
    prompt: stringValue(data.prompt, 12_000) ?? '',
    agent: stringValue(data.agent, 120) ?? 'build',
    model: stringValue(data.model, 200),
    status,
    createdBy: stringValue(data.createdBy, 120) ?? '',
    createdAt: stringValue(data.createdAt, 80) ?? new Date().toISOString(),
    updatedAt: stringValue(data.updatedAt, 80) ?? new Date().toISOString(),
    dispatchedAt: stringValue(data.dispatchedAt, 80),
    completedAt: stringValue(data.completedAt, 80),
    lastError: stringValue(data.lastError, 2000),
    progress:
      data.progress && typeof data.progress === 'object'
        ? {
            completed: numberValue((data.progress as Loose).completed) ?? 0,
            total: numberValue((data.progress as Loose).total) ?? 0,
          }
        : null,
    changedFileCount: numberValue(data.changedFileCount) ?? 0,
  };
}

export async function listOpenCodeTasks(db: Firestore, limit = 30): Promise<OpenCodeTaskRecord[]> {
  try {
    const snap = await db.collection(OPENCODE_TASKS_COLLECTION).limit(Math.min(100, Math.max(1, limit))).get();
    return snap.docs
      .map((doc) => taskFromDoc(doc.id, (doc.data() ?? {}) as Loose))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error('[opencode] task list failed', error);
    return [];
  }
}

export async function getOpenCodeTask(db: Firestore, id: string): Promise<OpenCodeTaskRecord | null> {
  if (!id) return null;
  const snap = await db.collection(OPENCODE_TASKS_COLLECTION).doc(id).get();
  return snap.exists ? taskFromDoc(snap.id, (snap.data() ?? {}) as Loose) : null;
}

export async function findOpenCodeTaskForProposal(
  db: Firestore,
  proposalId: string,
): Promise<OpenCodeTaskRecord | null> {
  const snap = await db
    .collection(OPENCODE_TASKS_COLLECTION)
    .where('proposalId', '==', proposalId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? taskFromDoc(doc.id, (doc.data() ?? {}) as Loose) : null;
}

async function saveTask(db: Firestore, task: OpenCodeTaskRecord): Promise<void> {
  await db.collection(OPENCODE_TASKS_COLLECTION).doc(task.id).set(task, { merge: true });
}

export interface StartTaskInput {
  proposalId: string;
  title: string;
  prompt: string;
  agent?: string | null;
  createdBy: string;
}

export interface StartTaskResult {
  task: OpenCodeTaskRecord;
  dispatched: boolean;
  error: string | null;
}

export async function startOpenCodeTask(
  db: Firestore,
  input: StartTaskInput,
): Promise<StartTaskResult> {
  const config = openCodeConfig();
  if (!config) {
    throw new OpenCodeError('not_configured', 'OpenCode is not configured on this server.');
  }
  if (!config.directory) {
    throw new OpenCodeError(
      'not_configured',
      'OpenCode has no isolated workspace. Set OPENCODE_DIRECTORY on the VPS before starting coding tasks.',
    );
  }

  const title = cleanText(input.title, 160) || 'Vidnov approved task';
  const prompt = cleanText(input.prompt, 12_000);
  if (!prompt) throw new OpenCodeError('bad_response', 'The approved task has no prompt.');
  const agent = (input.agent && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(input.agent)
    ? input.agent
    : config.agent);

  const session = await request(config, '/session', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }, OPENCODE_TASK_TIMEOUT_MS);
  const sessionBody = (session.body ?? {}) as Loose;
  const sessionId = stringValue(sessionBody.id, 200);
  if (!sessionId) {
    throw new OpenCodeError('bad_response', 'OpenCode created no session id.');
  }

  const ref = db.collection(OPENCODE_TASKS_COLLECTION).doc();
  const now = new Date().toISOString();
  let task: OpenCodeTaskRecord = {
    id: ref.id,
    proposalId: input.proposalId,
    sessionId,
    title,
    prompt,
    agent,
    model: config.model ? `${config.model.providerID}/${config.model.modelID}` : null,
    status: 'queued',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    dispatchedAt: null,
    completedAt: null,
    lastError: null,
    progress: null,
    changedFileCount: 0,
  };

  try {
    await saveTask(db, task);
  } catch (error) {
    console.error('[opencode] task record write failed', error);
    await request(config, `/session/${encodeURIComponent(sessionId)}/abort`, { method: 'POST' }).catch(() => undefined);
    throw new OpenCodeError('unreachable', 'The task could not be recorded; the OpenCode session was aborted.');
  }

  try {
    await request(
      config,
      `/session/${encodeURIComponent(sessionId)}/prompt_async`,
      {
        method: 'POST',
        body: JSON.stringify({
          agent,
          parts: [{ type: 'text', text: prompt }],
          ...(config.model ? { model: config.model } : {}),
        }),
      },
      OPENCODE_TASK_TIMEOUT_MS,
    );
    task = { ...task, status: 'queued', dispatchedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveTask(db, task);
    return { task, dispatched: true, error: null };
  } catch (error) {
    const message = publicError(error);
    task = {
      ...task,
      status: 'failed',
      lastError: message,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await saveTask(db, task).catch(() => undefined);
    return { task, dispatched: false, error: message };
  }
}

function parseMessages(payload: unknown): {
  messages: OpenCodeMessage[];
  output: string;
  tools: OpenCodeTool[];
  tests: OpenCodeTestResult[];
  changedFiles: OpenCodeChangedFile[];
  error: string | null;
  completed: boolean;
} {
  if (!Array.isArray(payload)) {
    return {
      messages: [],
      output: '',
      tools: [],
      tests: [],
      changedFiles: [],
      error: null,
      completed: false,
    };
  }

  const messages: OpenCodeMessage[] = [];
  const assistantText: string[] = [];
  const tools: OpenCodeTool[] = [];
  const tests: OpenCodeTestResult[] = [];
  const changedFiles = new Map<string, OpenCodeChangedFile>();
  let error: string | null = null;
  let completed = false;

  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Loose;
    const info = record.info && typeof record.info === 'object' ? (record.info as Loose) : {};
    const parts = Array.isArray(record.parts) ? record.parts : [];
    const role = stringValue(info.role, 30) ?? 'unknown';
    const id = stringValue(info.id, 120) ?? `message_${messages.length}`;
    const createdAt = isoTimestamp((info.time as Loose | undefined)?.created);
    const infoError = info.error && typeof info.error === 'object' ? (info.error as Loose) : null;
    const messageError =
      infoError && infoError.data && typeof infoError.data === 'object'
        ? stringValue((infoError.data as Loose).message, 1000)
        : null;
    if (messageError) error = messageError;

    let messageText = '';
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const value = part as Loose;
      const partType = stringValue(value.type, 40);

      if (partType === 'text') {
        const text = stringValue(value.text, 20_000);
        if (text) messageText = messageText ? `${messageText}\n${text}` : text;
      }

      if (partType === 'patch' && Array.isArray(value.files)) {
        for (const file of value.files) {
          const path = stringValue(file, 500);
          if (path) changedFiles.set(path, { file: path, additions: 0, deletions: 0 });
        }
      }

      if (partType === 'tool') {
        const state = value.state && typeof value.state === 'object' ? (value.state as Loose) : {};
        const input = state.input && typeof state.input === 'object' ? (state.input as Loose) : {};
        const command = stringValue(input.command, 500);
        const toolName = stringValue(value.tool, 80) ?? 'tool';
        const output = stringValue(state.output, 4000);
        const toolError = stringValue(state.error, 2000);
        const status = stringValue(state.status, 30) ?? 'unknown';
        const title = stringValue(state.title, 400);
        tools.push({ tool: toolName, status, title, command, output, error: toolError });
        if (
          command &&
          /(^|\s)(test|vitest|jest|tsc|typecheck|lint|eslint|build)(\s|$|:)/i.test(command)
        ) {
          tests.push({
            command,
            status,
            output: output ?? toolError ?? '',
          });
        }
      }
    }

    if (messageText) {
      messages.push({ id, role, text: messageText, createdAt, error: messageError });
      if (role === 'assistant') assistantText.push(messageText);
    } else if (messageError) {
      messages.push({ id, role, text: '', createdAt, error: messageError });
    }

    if (role === 'assistant' && isoTimestamp((info.time as Loose | undefined)?.completed)) {
      completed = true;
    }
  }

  return {
    messages,
    output: assistantText.join('\n\n').slice(0, 20_000),
    tools,
    tests,
    changedFiles: [...changedFiles.values()],
    error,
    completed,
  };
}

function parseTodos(payload: unknown): OpenCodeTodo[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const value = raw as Loose;
      const content = stringValue(value.content, 400);
      if (!content) return null;
      return {
        id: stringValue(value.id, 120) ?? content,
        content,
        status: stringValue(value.status, 40) ?? 'pending',
        priority: stringValue(value.priority, 30) ?? 'medium',
      };
    })
    .filter((todo): todo is OpenCodeTodo => Boolean(todo));
}

function parseDiff(payload: unknown): OpenCodeChangedFile[] {
  if (!Array.isArray(payload)) return [];
  const out = new Map<string, OpenCodeChangedFile>();
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue;
    const value = raw as Loose;
    const file = stringValue(value.file, 500);
    if (!file) continue;
    out.set(file, {
      file,
      additions: numberValue(value.additions) ?? 0,
      deletions: numberValue(value.deletions) ?? 0,
    });
  }
  return [...out.values()];
}

/**
 * Reads the current OpenCode state and updates the stored task with the real
 * derived status. If OpenCode cannot answer, the last known status is kept and
 * `syncError` is returned — the app never invents a successful run.
 */
export async function syncOpenCodeTask(
  db: Firestore,
  task: OpenCodeTaskRecord,
  env: Record<string, string | undefined> = process.env,
): Promise<OpenCodeTaskDetail> {
  const empty: OpenCodeTaskDetail = {
    task,
    sessionStatus: 'unknown',
    output: '',
    changedFiles: [],
    tests: [],
    tools: [],
    todos: [],
    messages: [],
    error: task.lastError ?? null,
    syncError: null,
  };
  const config = openCodeConfig(env);
  if (!config) {
    return { ...empty, syncError: 'OpenCode is not configured on this server.' };
  }
  if (!task.sessionId) {
    return { ...empty, syncError: 'This task has no OpenCode session id.' };
  }

  const [statusResult, messagesResult, todosResult, diffResult] = await Promise.allSettled([
    request(config, '/session/status', { method: 'GET' }),
    request(config, `/session/${encodeURIComponent(task.sessionId)}/message?limit=60`, { method: 'GET' }),
    request(config, `/session/${encodeURIComponent(task.sessionId)}/todo`, { method: 'GET' }),
    request(config, `/session/${encodeURIComponent(task.sessionId)}/diff`, { method: 'GET' }),
  ]);

  const syncErrors: string[] = [];
  let sessionStatus: 'idle' | 'busy' | 'retry' | 'unknown' = 'unknown';
  let retryMessage: string | null = null;

  if (statusResult.status === 'fulfilled') {
    const statuses = (statusResult.value.body ?? {}) as Loose;
    const rawStatus = statuses[task.sessionId];
    if (rawStatus && typeof rawStatus === 'object') {
      const value = rawStatus as Loose;
      const type = stringValue(value.type, 30);
      if (type === 'idle' || type === 'busy' || type === 'retry') sessionStatus = type;
      if (type === 'retry') retryMessage = stringValue(value.message, 800);
    }
  } else {
    syncErrors.push(publicError(statusResult.reason));
  }

  const parsed =
    messagesResult.status === 'fulfilled'
      ? parseMessages(messagesResult.value.body)
      : {
          messages: [],
          output: '',
          tools: [],
          tests: [],
          changedFiles: [],
          error: null,
          completed: false,
        };
  if (messagesResult.status === 'rejected') syncErrors.push(publicError(messagesResult.reason));

  const todos = todosResult.status === 'fulfilled' ? parseTodos(todosResult.value.body) : [];
  if (todosResult.status === 'rejected') syncErrors.push(publicError(todosResult.reason));

  const diffs = diffResult.status === 'fulfilled' ? parseDiff(diffResult.value.body) : [];
  if (diffResult.status === 'rejected') syncErrors.push(publicError(diffResult.reason));

  const changedFiles = [...diffs, ...parsed.changedFiles].reduce((map, file) => {
    const current = map.get(file.file);
    if (!current || file.additions + file.deletions > current.additions + current.deletions) {
      map.set(file.file, file);
    }
    return map;
  }, new Map<string, OpenCodeChangedFile>());

  const error = parsed.error ?? retryMessage ?? null;
  const messagesAvailable = messagesResult.status === 'fulfilled';
  const statusesAvailable = statusResult.status === 'fulfilled';
  let status: OpenCodeTaskStatus = task.status;
  if (task.status !== 'cancelled') {
    if (error) status = 'failed';
    else if (sessionStatus === 'busy' || sessionStatus === 'retry') status = 'running';
    else if (parsed.completed) status = 'completed';
    else if (!messagesAvailable || !statusesAvailable || sessionStatus === 'unknown') status = task.status;
    else if (task.status === 'completed' || task.status === 'failed') status = task.status;
    else status = 'queued';
  }

  const completedCount = todos.filter((todo) => todo.status === 'completed').length;
  const updated: OpenCodeTaskRecord = {
    ...task,
    status,
    updatedAt: new Date().toISOString(),
    ...(status === 'completed' || status === 'failed' || status === 'cancelled'
      ? { completedAt: task.completedAt ?? new Date().toISOString() }
      : {}),
    lastError: error,
    progress: todos.length ? { completed: completedCount, total: todos.length } : task.progress ?? null,
    changedFileCount: changedFiles.size,
  };

  if (
    updated.status !== task.status ||
    updated.changedFileCount !== task.changedFileCount ||
    JSON.stringify(updated.progress) !== JSON.stringify(task.progress) ||
    updated.lastError !== task.lastError
  ) {
    await saveTask(db, updated).catch((saveError) => {
      console.error('[opencode] task status write failed', saveError);
    });
  }

  return {
    task: updated,
    sessionStatus,
    output: parsed.output,
    changedFiles: [...changedFiles.values()],
    tests: parsed.tests,
    tools: parsed.tools,
    todos,
    messages: parsed.messages,
    error,
    syncError: syncErrors.length ? syncErrors.join(' ') : null,
  };
}

export async function abortOpenCodeTask(
  db: Firestore,
  task: OpenCodeTaskRecord,
  env: Record<string, string | undefined> = process.env,
): Promise<OpenCodeTaskRecord> {
  const config = openCodeConfig(env);
  if (!config) throw new OpenCodeError('not_configured', 'OpenCode is not configured on this server.');
  if (!task.sessionId) throw new OpenCodeError('bad_response', 'This task has no OpenCode session.');

  const result = await request(
    config,
    `/session/${encodeURIComponent(task.sessionId)}/abort`,
    { method: 'POST' },
    OPENCODE_TASK_TIMEOUT_MS,
  );
  if (result.body !== true && result.status >= 300) {
    throw new OpenCodeError('rejected', 'OpenCode did not confirm the abort.');
  }

  const updated: OpenCodeTaskRecord = {
    ...task,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    lastError: 'Aborted by the founder.',
  };
  await saveTask(db, updated);
  return updated;
}
