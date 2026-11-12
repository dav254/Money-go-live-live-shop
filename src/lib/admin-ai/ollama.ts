/**
 * ADMIN AI — Ollama client (server only).
 *
 * The Android app never holds an Ollama address or key. It calls Vidnov's
 * admin routes, and those routes call this module. Two consequences matter:
 *
 *   1. the model is unreachable from the public internet by construction,
 *   2. every call is bounded by a timeout, so a stalled VPS shows an error
 *      instead of an endless spinner.
 *
 * Status is MEASURED, never assumed: "Ollama is installed" is not evidence
 * that it is running, and an installed model is not evidence that it loaded.
 */

import {
  OLLAMA_CHAT_TIMEOUT_MS,
  OLLAMA_TIMEOUT_MS,
  ollamaConfig,
  publicOllamaConfig,
  type OllamaConfig,
} from './config';
import { cleanText, isSafeModelName, stateFromProbe, type CheckState, type MessageRole } from './validate';

export class OllamaError extends Error {
  constructor(
    readonly code: 'not_configured' | 'unreachable' | 'timeout' | 'bad_response' | 'empty_response',
    message: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
}

export interface OllamaStatus {
  configured: boolean;
  state: CheckState;
  reachable: boolean;
  version: string | null;
  models: OllamaModelInfo[];
  activeModel: string;
  activeModelInstalled: boolean;
  hasApiKey: boolean;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
}

export interface ChatTurn {
  role: MessageRole;
  content: string;
}

export interface OllamaReply {
  content: string;
  model: string;
  latencyMs: number;
  evalCount: number | null;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new OllamaError('timeout', 'Ollama did not answer in time.');
    }
    throw new OllamaError('unreachable', 'Ollama could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(config: OllamaConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}

function toModel(raw: unknown): OllamaModelInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === 'string' ? cleanText(record.name, 120) : '';
  if (!name) return null;
  return {
    name,
    sizeBytes: typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : null,
    modifiedAt: typeof record.modified_at === 'string' ? record.modified_at : null,
  };
}

/**
 * Reads `/api/version` and `/api/tags` independently. One failing probe must
 * not hide the other: a version reply with a broken model list is still
 * information the founder needs.
 */
export async function probeOllama(
  env: Record<string, string | undefined> = process.env,
): Promise<OllamaStatus> {
  const checkedAt = new Date().toISOString();
  const publicConfig = publicOllamaConfig(env);
  const config = ollamaConfig(env);

  if (!config) {
    return {
      configured: false,
      state: 'unknown',
      reachable: false,
      version: null,
      models: [],
      activeModel: publicConfig.model ?? 'unknown',
      activeModelInstalled: false,
      hasApiKey: false,
      latencyMs: null,
      checkedAt,
      error: null,
    };
  }

  const started = Date.now();
  const headers = { Accept: 'application/json', ...authHeaders(config) };

  const [versionResult, tagsResult] = await Promise.allSettled([
    timedFetch(`${config.baseUrl}/api/version`, { method: 'GET', headers }, OLLAMA_TIMEOUT_MS),
    timedFetch(`${config.baseUrl}/api/tags`, { method: 'GET', headers }, OLLAMA_TIMEOUT_MS),
  ]);

  let version: string | null = null;
  const models: OllamaModelInfo[] = [];
  let reachable = false;
  let modelsKnown = false;
  let error: string | null = null;

  if (versionResult.status === 'fulfilled' && versionResult.value.ok) {
    reachable = true;
    const body = (await versionResult.value.json().catch(() => null)) as { version?: unknown } | null;
    if (typeof body?.version === 'string') version = cleanText(body.version, 40);
  } else if (versionResult.status === 'fulfilled') {
    error = `Ollama answered the version check with HTTP ${versionResult.value.status}.`;
  } else {
    error = (versionResult.reason as Error)?.message ?? 'Ollama could not be reached.';
  }

  if (tagsResult.status === 'fulfilled' && tagsResult.value.ok) {
    reachable = true;
    error = null;
    modelsKnown = true;
    const body = (await tagsResult.value.json().catch(() => null)) as { models?: unknown } | null;
    if (Array.isArray(body?.models)) {
      for (const item of body.models) {
        const model = toModel(item);
        if (model) models.push(model);
      }
    }
  } else if (!reachable) {
    const reason =
      tagsResult.status === 'fulfilled'
        ? `Ollama answered the model list with HTTP ${tagsResult.value.status}.`
        : ((tagsResult.reason as Error)?.message ?? 'Ollama could not be reached.');
    error = error ?? reason;
  }

  models.sort((a, b) => a.name.localeCompare(b.name));

  const activeModel = config.model;
  const activeModelInstalled = models.some(
    (model) => model.name === activeModel || model.name.startsWith(`${activeModel}:`),
  );

  return {
    configured: true,
    state: stateFromProbe({
      configured: true,
      reachable,
      // Reachable but the configured model is missing means the founder cannot
      // actually send a prompt — that is degraded, not healthy. This covers an
      // empty model list too: a known list without the model is still broken.
      degraded: reachable && modelsKnown && !activeModelInstalled,
    }),
    reachable,
    version,
    models,
    activeModel,
    activeModelInstalled,
    hasApiKey: Boolean(config.apiKey),
    latencyMs: Date.now() - started,
    checkedAt,
    error,
  };
}

/**
 * One non-streaming chat completion. Non-streaming on purpose: the mobile
 * client needs a complete, copyable answer and a bounded request, and a
 * half-rendered token stream is neither.
 */
export async function chatWithOllama(input: {
  messages: ChatTurn[];
  model?: string | null;
  env?: Record<string, string | undefined>;
}): Promise<OllamaReply> {
  const env = input.env ?? process.env;
  const config = ollamaConfig(env);
  if (!config) {
    throw new OllamaError('not_configured', 'Ollama is not configured on this server.');
  }

  const model = isSafeModelName(input.model) ? input.model : config.model;
  const messages = input.messages
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant' || turn.role === 'system'))
    .map((turn) => ({ role: turn.role, content: cleanText(turn.content, 24_000) }))
    .filter((turn) => turn.content.length > 0);

  if (messages.length === 0) {
    throw new OllamaError('bad_response', 'There is nothing to send to the model.');
  }

  const started = Date.now();
  const response = await timedFetch(
    `${config.baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders(config),
      },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } }),
    },
    OLLAMA_CHAT_TIMEOUT_MS,
  );

  if (!response.ok) {
    /*
     * Ollama answers 404 for an unknown model and 500 for a load failure. The
     * mobile screen gets one honest sentence; the status code is kept in the
     * server log only.
     */
    const detail = await response.text().catch(() => '');
    console.error(`[admin-ai/ollama] chat failed ${response.status}: ${detail.slice(0, 200)}`);
    throw new OllamaError(
      response.status === 404 ? 'bad_response' : 'unreachable',
      response.status === 404
        ? `The model "${model}" is not installed on this Ollama server.`
        : 'Ollama could not complete the request.',
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: { content?: unknown }; model?: unknown; eval_count?: unknown }
    | null;
  const content = typeof body?.message?.content === 'string' ? body.message.content.trim() : '';
  if (!content) {
    throw new OllamaError('empty_response', 'The model returned an empty answer.');
  }

  return {
    content,
    model: typeof body?.model === 'string' && isSafeModelName(body.model) ? body.model : model,
    latencyMs: Date.now() - started,
    evalCount: typeof body?.eval_count === 'number' && Number.isFinite(body.eval_count) ? body.eval_count : null,
  };
}
