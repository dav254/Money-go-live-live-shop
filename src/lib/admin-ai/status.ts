/**
 * ADMIN AI — verified status for the Command Centre.
 *
 * Every signal is measured here, on the server, right now. Nothing is cached
 * from "the last time it worked" unless that timestamp is shown next to it.
 *
 * The vocabulary is deliberate:
 *   online   — a probe succeeded
 *   degraded — reachable, but not fully usable
 *   offline  — a probe ran and failed
 *   unknown  — no probe could run (not configured / not supported)
 *
 * "Installed" never appears as a synonym for "running".
 */

import os from 'node:os';
import { db } from '@/firebase/server';
import { pbRequest, pocketBaseEnabled } from '@/lib/pocketbase/server';
import { ollamaConfig, publicOllamaConfig } from './config';
import { probeOllama } from './ollama';
import { probeOpenCode } from './opencode';
import { probePaperclip } from './paperclip';
import { readMeta, writeMeta, adminAiStoreAvailable } from '@/lib/pocketbase/admin-ai';
import { publicError, type CheckState } from './validate';

export interface SystemSignal {
  id: 'vidnov' | 'vps' | 'pocketbase' | 'firestore' | 'ollama' | 'paperclip' | 'opencode' | 'backups';
  label: string;
  state: CheckState;
  detail: string;
  checkedAt: string;
  /** Compact key figures for the system screen; values are already formatted. */
  figures?: { label: string; value: string }[];
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function vidnovSignal(now = new Date()): SystemSignal {
  return {
    id: 'vidnov',
    label: 'Vidnov application',
    state: 'online',
    detail: 'Answering this request from the application server.',
    checkedAt: now.toISOString(),
    figures: [{ label: 'Runtime', value: `Node ${process.version.replace(/^v/, '')}` }],
  };
}

export function vpsSignal(now = new Date()): SystemSignal {
  const load = os.loadavg()[0] ?? 0;
  const total = os.totalmem();
  const free = os.freemem();
  const usedRatio = total > 0 ? (total - free) / total : 0;
  const state: CheckState = usedRatio > 0.95 || load > os.cpus().length * 2 ? 'degraded' : 'online';

  return {
    id: 'vps',
    label: 'VPS host',
    state,
    detail:
      state === 'online'
        ? 'Host resources are within normal range.'
        : 'Host memory or load is high; AI requests may be slow.',
    checkedAt: now.toISOString(),
    figures: [
      { label: 'Host uptime', value: formatUptime(os.uptime()) },
      { label: 'Load (1m)', value: load.toFixed(2) },
      { label: 'Memory', value: `${formatBytes(total - free)} / ${formatBytes(total)}` },
    ],
  };
}

export async function pocketBaseSignal(now = new Date()): Promise<SystemSignal> {
  if (!pocketBaseEnabled()) {
    return {
      id: 'pocketbase',
      label: 'PocketBase',
      state: 'unknown',
      detail: 'PocketBase is not configured in this environment, so no check was performed.',
      checkedAt: now.toISOString(),
    };
  }
  try {
    const response = await pbRequest('/api/health', { method: 'GET' });
    return {
      id: 'pocketbase',
      label: 'PocketBase',
      state: response.ok ? 'online' : 'offline',
      detail: response.ok
        ? 'Health check answered successfully.'
        : `Health check answered with HTTP ${response.status}.`,
      checkedAt: now.toISOString(),
    };
  } catch (error) {
    return {
      id: 'pocketbase',
      label: 'PocketBase',
      state: 'offline',
      detail: publicError(error),
      checkedAt: now.toISOString(),
    };
  }
}

export async function firestoreSignal(now = new Date()): Promise<SystemSignal> {
  try {
    await db.collection('ai_hq_meta').doc('__ping').get();
    return {
      id: 'firestore',
      label: 'Firestore',
      state: 'online',
      detail: 'A bounded read completed successfully.',
      checkedAt: now.toISOString(),
    };
  } catch (error) {
    return {
      id: 'firestore',
      label: 'Firestore',
      state: 'offline',
      detail: publicError(error),
      checkedAt: now.toISOString(),
    };
  }
}

export async function ollamaSignal(now = new Date()): Promise<SystemSignal> {
  const status = await probeOllama();
  const config = publicOllamaConfig();

  if (!status.configured) {
    return {
      id: 'ollama',
      label: 'Ollama',
      state: 'unknown',
      detail: 'Ollama is not configured, so no connection check was performed.',
      checkedAt: now.toISOString(),
    };
  }

  const figures = [
    { label: 'Active model', value: config.model ?? status.activeModel },
    { label: 'Models', value: String(status.models.length) },
    { label: 'Latency', value: status.latencyMs === null ? '—' : `${status.latencyMs} ms` },
  ];

  if (status.state === 'online') {
    // Only persisted after a real successful probe, never on assumption.
    if (adminAiStoreAvailable()) {
      await writeMeta('ollama', {
        lastOkAt: status.checkedAt,
        version: status.version,
        model: status.activeModel,
      }).catch(() => undefined);
    }
    return {
      id: 'ollama',
      label: 'Ollama',
      state: 'online',
      detail: `Responding${status.version ? ` · version ${status.version}` : ''}. Model ${status.activeModel} is installed.`,
      checkedAt: status.checkedAt,
      figures,
    };
  }

  if (status.state === 'degraded') {
    return {
      id: 'ollama',
      label: 'Ollama',
      state: 'degraded',
      detail: `Reachable, but the configured model ${status.activeModel} was not found in its model list.`,
      checkedAt: status.checkedAt,
      figures,
    };
  }

  if (adminAiStoreAvailable()) {
    await writeMeta('ollama', { lastErrorAt: status.checkedAt, lastError: status.error }).catch(() => undefined);
  }

  return {
    id: 'ollama',
    label: 'Ollama',
    state: 'offline',
    detail: status.error ?? 'Ollama could not be reached from the Vidnov server.',
    checkedAt: status.checkedAt,
    figures,
  };
}

export async function opencodeSignal(now = new Date()): Promise<SystemSignal> {
  const status = await probeOpenCode();
  return {
    id: 'opencode',
    label: 'OpenCode',
    state: status.state,
    detail: status.configured
      ? status.reachable
        ? `Agent ${status.agent}${status.agentsAvailable ? ` · ${status.agents.length} listed` : ''}${status.workspaceConfigured ? ' · isolated workspace' : ' · no isolated workspace'}.`
        : status.error ?? 'OpenCode could not be reached from the Vidnov server.'
      : 'OpenCode is not configured, so no connection check was performed.',
    checkedAt: status.checkedAt,
    figures: status.configured
      ? [
          { label: 'Agent', value: status.agent },
          { label: 'Model', value: status.model ?? 'agent default' },
          { label: 'Workspace', value: status.workspaceConfigured ? 'isolated' : 'not set' },
        ]
      : undefined,
  };
}

export async function paperclipSignal(now = new Date()): Promise<SystemSignal> {
  const status = await probePaperclip();
  return {
    id: 'paperclip',
    label: 'Paperclip',
    state: status.state,
    detail: status.detail,
    checkedAt: now.toISOString(),
    figures: status.agentsAvailable
      ? [{ label: 'Agents', value: String(status.agents.length) }]
      : undefined,
  };
}

/**
 * Backups are only reported when a monitoring endpoint exists. There is no
 * guesswork: no URL means UNKNOWN, and the app says so.
 */
export async function backupSignal(now = new Date()): Promise<SystemSignal> {
  const url = (process.env.BACKUP_HEALTH_URL ?? '').trim();
  const label = 'Backups';
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      id: 'backups',
      label,
      state: 'unknown',
      detail: 'No backup monitoring endpoint is configured, so no check was performed.',
      checkedAt: now.toISOString(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        id: 'backups',
        label,
        state: 'offline',
        detail: `The backup endpoint answered with HTTP ${response.status}.`,
        checkedAt: now.toISOString(),
      };
    }
    const body = (await response.json().catch(() => null)) as { lastBackupAt?: unknown } | null;
    const lastBackupAt = typeof body?.lastBackupAt === 'string' ? body.lastBackupAt : null;
    return {
      id: 'backups',
      label,
      state: 'online',
      detail: lastBackupAt ? `Last backup reported at ${lastBackupAt}.` : 'The backup endpoint answered successfully.',
      checkedAt: now.toISOString(),
      figures: lastBackupAt ? [{ label: 'Last backup', value: lastBackupAt }] : undefined,
    };
  } catch (error) {
    return {
      id: 'backups',
      label,
      state: 'offline',
      detail: publicError(error),
      checkedAt: now.toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function collectSystemSignals(): Promise<{ signals: SystemSignal[]; checkedAt: string }> {
  const now = new Date();
  const [pocketbase, firestore, ollama, paperclip, opencode, backups] = await Promise.all([
    pocketBaseSignal(now),
    firestoreSignal(now),
    ollamaSignal(now),
    paperclipSignal(now),
    opencodeSignal(now),
    backupSignal(now),
  ]);
  return {
    checkedAt: now.toISOString(),
    signals: [vidnovSignal(now), vpsSignal(now), pocketbase, firestore, ollama, paperclip, opencode, backups],
  };
}

/** Last successful Ollama contact, read from the local store when available. */
export async function lastOllamaSuccess(): Promise<string | null> {
  if (!adminAiStoreAvailable()) return null;
  try {
    const meta = await readMeta('ollama');
    return typeof meta?.lastOkAt === 'string' ? meta.lastOkAt : null;
  } catch {
    return null;
  }
}

export function ollamaConfigured(): boolean {
  return Boolean(ollamaConfig());
}
