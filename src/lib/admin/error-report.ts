/**
 * ERROR REPORT BUILDER — turns the `errorLogs` collection into a paste-ready
 * plain-text report the admin can hand straight to an assistant.
 *
 * ## Why this exists
 * Errors are captured app-wide (GlobalErrorListener → DeferredErrorLogger →
 * POST /api/error-log → Firestore `errorLogs`) but a table of one-line
 * messages is not actionable: the fix needs the stack, the context, the
 * user/environment — the lot. This builder produces one deterministic text
 * block with everything a debugging session needs, bounded so a chat paste
 * stays readable (20 newest entries, 12 stack lines each, one-line messages).
 *
 * ## Honesty rules
 * - Only fields a document actually carries are written; absent fields are
 *   omitted, never printed as `undefined`/`null`.
 * - Writers disagree on field names (`message` vs `errorMessage`, `stack` vs
 *   `errorStack`) — both are read, so no real error is silently dropped.
 * - Timestamps accept ISO strings and Firestore Timestamp-shaped objects;
 *   an unrecognisable value reads "unknown time" rather than being guessed.
 */
import type { ErrorLog } from '@/lib/types';

export interface ErrorReportOptions {
  /** Newest entries to include — a report is for reading, not archiving. */
  maxEntries?: number;
  /** Stack lines kept per entry. */
  maxStackLines?: number;
  /** Injection point for deterministic tests. */
  generatedAt?: Date;
}

export const DEFAULT_MAX_ENTRIES = 20;
export const DEFAULT_MAX_STACK_LINES = 12;

/** ISO stamp from an ISO string or a Firestore Timestamp-shaped object. */
function isoStamp(value: unknown): string | null {
  if (typeof value === 'string') {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value : null;
  }
  const maybe = value as { toDate?: () => Date } | null | undefined;
  if (maybe && typeof maybe.toDate === 'function') {
    try {
      return maybe.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Trimmed single line capped to `max` — one error, one line. */
function oneLine(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The stack from whichever writer produced it, trimmed. */
function stackOf(log: ErrorLog): string | null {
  const raw = log.errorStack ?? log.stack;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/** Human timestamp — never an invented date. */
function whenOf(log: ErrorLog): string {
  return isoStamp(log.timestamp) ?? 'unknown time';
}

/**
 * The full report: header + one block per entry, newest first (as given).
 * Deterministic when `generatedAt` is provided — unit-tested in
 * `src/tests/error-report.test.ts`.
 */
export function buildErrorReport(logs: ErrorLog[], opts: ErrorReportOptions = {}): string {
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxStackLines = opts.maxStackLines ?? DEFAULT_MAX_STACK_LINES;
  const generatedAt = (opts.generatedAt ?? new Date()).toISOString();
  const entries = logs.slice(0, Math.max(0, maxEntries));

  const lines: string[] = [];
  lines.push('VIDNOV ERROR REPORT');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Entries: ${entries.length}${logs.length > entries.length ? ` of ${logs.length}` : ''} (newest first)`);
  const unresolved = entries.filter((log) => (log.status ?? 'new') === 'new').length;
  lines.push(`Unresolved: ${unresolved}`);
  lines.push('');

  if (entries.length === 0) {
    lines.push('No errors recorded.');
    lines.push('');
    return lines.join('\n');
  }

  entries.forEach((log, index) => {
    const message = oneLine(log.errorMessage ?? log.message) ?? 'Unknown Error';
    lines.push(`#${index + 1} [${whenOf(log)}] (${log.status ?? 'new'}) ${message}`);

    const user = oneLine(log.userId, 120);
    if (user) lines.push(`   user: ${user}`);

    const environment = oneLine(log.environment, 40);
    if (environment) lines.push(`   environment: ${environment}`);

    const userAgent = oneLine(log.userAgent, 200);
    if (userAgent) lines.push(`   userAgent: ${userAgent}`);

    if (log.context && typeof log.context === 'object') {
      const context = oneLine(JSON.stringify(log.context), 800);
      if (context) lines.push(`   context: ${context}`);
    }

    const stack = stackOf(log);
    if (stack) {
      const allLines = stack.split('\n');
      lines.push('   stack:');
      for (const stackLine of allLines.slice(0, maxStackLines)) {
        lines.push(`     ${stackLine.trim()}`);
      }
      if (allLines.length > maxStackLines) {
        lines.push(`     … ${allLines.length - maxStackLines} more lines`);
      }
    }
    lines.push('');
  });

  return lines.join('\n');
}
