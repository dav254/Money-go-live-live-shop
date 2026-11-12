/**
 * ADMIN AI — Paperclip probe (server only).
 *
 * PAPERCLIP IS OPTIONAL AND UNVERIFIED.
 *
 * There is no published Paperclip API contract in this repository, so this
 * module does the only honest thing an admin console can do:
 *
 *   • no configured URL            → UNKNOWN ("not configured"),
 *   • configured but unreachable   → OFFLINE with the measured error,
 *   • reachable but unreadable     → DEGRADED ("answered, shape not recognised"),
 *   • reachable with an agent list → ONLINE and exactly those agents.
 *
 * It never invents agents, never fabricates task progress, and it does not
 * claim report/task capabilities it has not parsed. The app shows "not
 * available from the verified API" for those, which is true.
 */

import { PAPERCLIP_TIMEOUT_MS, paperclipConfig } from './config';
import { cleanText, stateFromProbe, type CheckState } from './validate';

export interface PaperclipAgent {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
  lastActiveAt: string | null;
}

export interface PaperclipStatus {
  configured: boolean;
  state: CheckState;
  reachable: boolean;
  detail: string;
  agents: PaperclipAgent[];
  /** True only when an actual agent array was parsed. */
  agentsAvailable: boolean;
  /** Phase 1 parses no task/report endpoints; false is the honest answer. */
  activityAvailable: boolean;
  reportsAvailable: boolean;
  pendingAvailable: boolean;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return cleanText(value, 160);
  }
  return null;
}

function mapAgent(raw: unknown): PaperclipAgent | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = pickString(record, ['id', 'agentId', 'slug']);
  const name = pickString(record, ['name', 'displayName', 'title']);
  if (!id && !name) return null;
  return {
    id: id ?? name ?? 'agent',
    name: name ?? id ?? 'Unnamed agent',
    role: pickString(record, ['role', 'title', 'department']),
    status: pickString(record, ['status', 'state']),
    lastActiveAt: pickString(record, ['lastActiveAt', 'last_active_at', 'updatedAt', 'updated_at']),
  };
}

/** Accepts a bare array or the usual `{ agents | data | items: [] }` envelopes. */
function extractAgents(payload: unknown): PaperclipAgent[] | null {
  const candidates: unknown[] = [];
  if (Array.isArray(payload)) candidates.push(payload);
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['agents', 'data', 'items', 'results']) {
      if (Array.isArray(record[key])) candidates.push(record[key]);
    }
  }
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const mapped = candidate.map(mapAgent).filter((agent): agent is PaperclipAgent => Boolean(agent));
    if (mapped.length > 0) return mapped;
    if (candidate.length === 0) return [];
  }
  return null;
}

export async function probePaperclip(
  env: Record<string, string | undefined> = process.env,
): Promise<PaperclipStatus> {
  const checkedAt = new Date().toISOString();
  const config = paperclipConfig(env);
  const base = {
    agents: [] as PaperclipAgent[],
    agentsAvailable: false,
    activityAvailable: false,
    reportsAvailable: false,
    pendingAvailable: false,
    latencyMs: null as number | null,
    checkedAt,
  };

  if (!config) {
    return {
      ...base,
      configured: false,
      state: 'unknown',
      reachable: false,
      detail: 'Paperclip is not configured on this server (PAPERCLIP_API_URL is not set).',
      error: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAPERCLIP_TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(`${config.baseUrl}${config.agentsPath}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        ...base,
        latencyMs,
        configured: true,
        state: 'offline',
        reachable: true,
        detail: `Paperclip answered with HTTP ${response.status}. Its API may be disabled or the path may differ.`,
        error: `HTTP ${response.status}`,
      };
    }

    const payload = await response.json().catch(() => null);
    const agents = extractAgents(payload);

    if (agents === null) {
      return {
        ...base,
        latencyMs,
        configured: true,
        state: 'degraded',
        reachable: true,
        detail:
          'Paperclip answered, but no supported agent list was found. Nothing is displayed rather than guessing.',
        error: null,
      };
    }

    return {
      ...base,
      latencyMs,
      configured: true,
      state: stateFromProbe({ configured: true, reachable: true }),
      reachable: true,
      detail:
        agents.length > 0
          ? `${agents.length} agent${agents.length === 1 ? '' : 's'} reported by Paperclip.`
          : 'Paperclip is reachable and reported no registered agents.',
      agents,
      agentsAvailable: true,
      error: null,
    };
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    return {
      ...base,
      latencyMs: Date.now() - started,
      configured: true,
      state: 'offline',
      reachable: false,
      detail: aborted
        ? 'Paperclip did not answer in time.'
        : 'Paperclip could not be reached from the Vidnov server.',
      error: aborted ? 'timeout' : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
