/**
 * ADMIN AI COMMAND CENTRE — server configuration.
 *
 * Two private services sit behind this module:
 *
 *   • Ollama on the VPS, addressed over its local HTTP API,
 *   • Paperclip, if (and only if) the installation exposes an API.
 *
 * Neither address is ever sent to the Android client. The app talks to Vidnov
 * routes that are authenticated with an admin bearer token; this file is the
 * only place the upstream URLs and secrets exist, and `publicOllamaConfig` /
 * `publicPaperclipConfig` deliberately expose booleans, never values.
 *
 * Everything is read from the environment at call time (not at import time) so
 * a server can be reconfigured without a rebuild, and so tests can inject a
 * fake `env` object.
 */

export const OLLAMA_ENV = {
  baseUrl: 'OLLAMA_BASE_URL',
  model: 'OLLAMA_MODEL',
  apiKey: 'OLLAMA_API_KEY',
} as const;

export const PAPERCLIP_ENV = {
  baseUrl: 'PAPERCLIP_API_URL',
  token: 'PAPERCLIP_API_TOKEN',
  agentsPath: 'PAPERCLIP_AGENTS_PATH',
} as const;

export const OPENCODE_ENV = {
  baseUrl: 'OPENCODE_BASE_URL',
  username: 'OPENCODE_SERVER_USERNAME',
  password: 'OPENCODE_SERVER_PASSWORD',
  agent: 'OPENCODE_AGENT',
  directory: 'OPENCODE_DIRECTORY',
  modelProvider: 'OPENCODE_MODEL_PROVIDER',
  modelId: 'OPENCODE_MODEL_ID',
} as const;

/** Ollama's own default. A VPS install normally listens here. */
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/** The model the founder installed. Only a default — the list is measured. */
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5-coder:3b';

/** Paperclip's agent list is not assumed; the operator names the path. */
export const DEFAULT_PAPERCLIP_AGENTS_PATH = '/api/agents';

/** OpenCode serve defaults to loopback port 4096 and agent `build`. */
export const DEFAULT_OPENCODE_BASE_URL = 'http://127.0.0.1:4096';
export const DEFAULT_OPENCODE_AGENT = 'build';
export const DEFAULT_OPENCODE_USERNAME = 'opencode';

/** Bounded upstream calls: a hung service must become a visible error. */
export const OLLAMA_TIMEOUT_MS = 8_000;
export const OLLAMA_CHAT_TIMEOUT_MS = 120_000;
export const PAPERCLIP_TIMEOUT_MS = 8_000;
export const OPENCODE_TIMEOUT_MS = 8_000;
export const OPENCODE_TASK_TIMEOUT_MS = 20_000;

const SAFE_URL = /^https?:\/\/[^\s]+$/i;
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,80}$/;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/;
const SAFE_PATH = /^\/[^\u0000-\u001F]{0,500}$/;

export interface OllamaConfig {
  /** Absolute, trailing-slash-free base URL. */
  baseUrl: string;
  model: string;
  /** Present only when the operator set one; never returned to a client. */
  apiKey: string | null;
  /** True when OLLAMA_BASE_URL was set explicitly. */
  explicit: boolean;
}

export function ollamaConfig(env: Record<string, string | undefined> = process.env): OllamaConfig | null {
  const raw = (env[OLLAMA_ENV.baseUrl] ?? '').trim() || DEFAULT_OLLAMA_BASE_URL;
  if (!SAFE_URL.test(raw)) return null;

  const modelRaw = (env[OLLAMA_ENV.model] ?? '').trim() || DEFAULT_OLLAMA_MODEL;
  const model = SAFE_MODEL.test(modelRaw) ? modelRaw : DEFAULT_OLLAMA_MODEL;
  const apiKey = (env[OLLAMA_ENV.apiKey] ?? '').trim() || null;

  return {
    baseUrl: raw.replace(/\/+$/, ''),
    model,
    apiKey,
    explicit: Boolean((env[OLLAMA_ENV.baseUrl] ?? '').trim()),
  };
}

export interface PaperclipConfig {
  baseUrl: string;
  agentsPath: string;
  token: string | null;
}

/**
 * Paperclip is OPTIONAL. No URL means the Command Centre says UNKNOWN — it does
 * not pretend an install that has no reachable API is "connected".
 */
export function paperclipConfig(
  env: Record<string, string | undefined> = process.env,
): PaperclipConfig | null {
  const raw = (env[PAPERCLIP_ENV.baseUrl] ?? '').trim();
  if (!raw || !SAFE_URL.test(raw)) return null;

  const pathRaw = (env[PAPERCLIP_ENV.agentsPath] ?? '').trim() || DEFAULT_PAPERCLIP_AGENTS_PATH;
  const agentsPath = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
  const token = (env[PAPERCLIP_ENV.token] ?? '').trim() || null;

  return {
    baseUrl: raw.replace(/\/+$/, ''),
    agentsPath,
    token,
  };
}

/** What the app is allowed to know about the configuration. */
export function publicOllamaConfig(env: Record<string, string | undefined> = process.env) {
  const config = ollamaConfig(env);
  return {
    configured: Boolean(config),
    model: config?.model ?? null,
    hasApiKey: Boolean(config?.apiKey),
  };
}

export function publicPaperclipConfig(env: Record<string, string | undefined> = process.env) {
  return {
    configured: Boolean(paperclipConfig(env)),
  };
}

export interface OpenCodeConfig {
  /** Absolute, trailing-slash-free base URL. */
  baseUrl: string;
  username: string;
  /** Basic-auth password. Never returned to a client. */
  password: string | null;
  /** Agent name sent with coding prompts. */
  agent: string;
  /** Optional isolated worktree passed as the OpenCode `directory` query. */
  directory: string | null;
  /** Optional model override; both parts must be configured together. */
  model: { providerID: string; modelID: string } | null;
  /** True when OPENCODE_BASE_URL was set explicitly. */
  explicit: boolean;
}

/**
 * OpenCode is expected on the VPS loopback. The server (not the APK) is the
 * only thing that knows the address, basic-auth password, workspace path and
 * optional coding model.
 */
export function openCodeConfig(
  env: Record<string, string | undefined> = process.env,
): OpenCodeConfig | null {
  const raw = (env[OPENCODE_ENV.baseUrl] ?? '').trim() || DEFAULT_OPENCODE_BASE_URL;
  if (!SAFE_URL.test(raw)) return null;

  const usernameRaw = (env[OPENCODE_ENV.username] ?? '').trim() || DEFAULT_OPENCODE_USERNAME;
  const username = SAFE_NAME.test(usernameRaw) ? usernameRaw : DEFAULT_OPENCODE_USERNAME;
  const password = (env[OPENCODE_ENV.password] ?? '').trim() || null;

  const agentRaw = (env[OPENCODE_ENV.agent] ?? '').trim() || DEFAULT_OPENCODE_AGENT;
  const agent = SAFE_NAME.test(agentRaw) ? agentRaw : DEFAULT_OPENCODE_AGENT;

  const directoryRaw = (env[OPENCODE_ENV.directory] ?? '').trim();
  const directory = directoryRaw && SAFE_PATH.test(directoryRaw) ? directoryRaw : null;

  const provider = (env[OPENCODE_ENV.modelProvider] ?? '').trim();
  const modelId = (env[OPENCODE_ENV.modelId] ?? '').trim();
  const model =
    provider && modelId && SAFE_NAME.test(provider) && SAFE_NAME.test(modelId)
      ? { providerID: provider, modelID: modelId }
      : null;

  return {
    baseUrl: raw.replace(/\/+$/, ''),
    username,
    password,
    agent,
    directory,
    model,
    explicit: Boolean((env[OPENCODE_ENV.baseUrl] ?? '').trim()),
  };
}

/** What the app is allowed to know about OpenCode. */
export function publicOpenCodeConfig(env: Record<string, string | undefined> = process.env) {
  const config = openCodeConfig(env);
  return {
    configured: Boolean(config),
    explicit: Boolean(config?.explicit),
    hasPassword: Boolean(config?.password),
    agent: config?.agent ?? null,
    model: config?.model ? `${config.model.providerID}/${config.model.modelID}` : null,
    workspaceConfigured: Boolean(config?.directory),
  };
}
