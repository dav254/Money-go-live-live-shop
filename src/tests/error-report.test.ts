/**
 * THE ADMIN ERROR CENTER — the paste-your-errors-here section.
 *
 *   • the report carries everything a debugging session needs (message,
 *     stack, context, user, environment, userAgent) and NOTHING the document
 *     does not carry — absent fields are omitted, never printed as
 *     `undefined`/`null`;
 *   • both writer namings are read (`errorMessage`/`message`,
 *     `errorStack`/`stack`) so no real error is dropped;
 *   • messages stay one line, entries and stack lines stay chat-sized;
 *   • the route is no longer a "Section Removed" dead end: it reads
 *     `errorLogs`, honours the API's `?filter=report-<id>` link, and copies;
 *   • the platform-health AI signal links to a route that exists.
 *
 * Run: npx tsx --test src/tests/error-report.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildErrorReport,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_STACK_LINES,
} from '../lib/admin/error-report';
import type { ErrorLog } from '../lib/types';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const STAMP = '2026-10-30T09:00:00.000Z';
const GENERATED = new Date('2026-10-30T12:00:00.000Z');

describe('the report carries what a debugging session needs', () => {
  it('writes the header, counts and every real field exactly once', () => {
    const log: ErrorLog = {
      id: 'r1',
      message: 'legacy message',
      errorMessage: 'TypeError: x is not a function',
      errorStack: 'at foo (a.ts:1:1)\nat bar (b.ts:2:2)',
      userId: 'uid-1',
      environment: 'production',
      userAgent: 'Mozilla/5.0',
      context: { type: 'global', lineno: 42 },
      status: 'new',
      timestamp: STAMP,
    };
    const text = buildErrorReport([log], { generatedAt: GENERATED });
    assert.ok(text.startsWith('VIDNOV ERROR REPORT'));
    assert.ok(text.includes('Generated: 2026-10-30T12:00:00.000Z'));
    assert.ok(text.includes('Entries: 1 (newest first)'));
    assert.ok(text.includes('Unresolved: 1'));
    assert.ok(text.includes(`#1 [${STAMP}] (new) TypeError: x is not a function`));
    assert.ok(text.includes('user: uid-1'));
    assert.ok(text.includes('environment: production'));
    assert.ok(text.includes('userAgent: Mozilla/5.0'));
    assert.ok(text.includes('context: {"type":"global","lineno":42}'));
    assert.ok(text.includes('stack:'));
    assert.ok(text.includes('at foo (a.ts:1:1)'));
    assert.equal(text.includes('legacy message'), false, 'errorMessage wins when both exist');
  });

  it('reads the other writer naming: message + stack', () => {
    const text = buildErrorReport([{ message: 'Plain failure', stack: 'boom at line' }], {
      generatedAt: GENERATED,
    });
    assert.ok(text.includes('Plain failure'));
    assert.ok(text.includes('boom at line'));
  });

  it('omits fields the document does not carry — never prints undefined/null', () => {
    const text = buildErrorReport([{ message: 'only message' }], { generatedAt: GENERATED });
    assert.equal(text.includes('undefined'), false);
    assert.equal(text.includes('null'), false);
    assert.equal(text.includes('user:'), false);
    assert.equal(text.includes('environment:'), false);
    assert.equal(text.includes('stack:'), false);
    assert.equal(text.includes('context:'), false);
  });

  it('collapses newlines so one error stays on one header line', () => {
    const text = buildErrorReport([{ message: 'line one\nline two' }], { generatedAt: GENERATED });
    assert.ok(text.includes('line one line two'));
    assert.equal(text.includes('line one\nline two'), false);
  });

  it('accepts Timestamp-shaped times and admits an unknown time', () => {
    const timed = buildErrorReport(
      [{ message: 'stamped', timestamp: { toDate: () => new Date(STAMP) } }],
      { generatedAt: GENERATED },
    );
    assert.ok(timed.includes(`[${STAMP}]`));
    const untimed = buildErrorReport([{ message: 'no time', timestamp: 12345 }], {
      generatedAt: GENERATED,
    });
    assert.ok(untimed.includes('[unknown time]'));
  });

  it('bounds entries and stack lines to stay chat-sized', () => {
    const many: ErrorLog[] = Array.from({ length: 30 }, (_, i) => ({ message: `err ${i}` }));
    const text = buildErrorReport(many, { maxEntries: 5, generatedAt: GENERATED });
    assert.ok(text.includes('Entries: 5 of 30 (newest first)'));
    assert.ok(text.includes('#5 '), 'the fifth entry is included');
    assert.equal(text.includes('#6 '), false, 'the sixth is not');

    const deep: ErrorLog = {
      message: 'deep',
      errorStack: Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n'),
    };
    const stacked = buildErrorReport([deep], { maxStackLines: 3, generatedAt: GENERATED });
    assert.ok(stacked.includes('line 2'), 'first three lines shown');
    assert.equal(stacked.includes('line 3'), false, 'the rest are elided');
    assert.ok(stacked.includes('… 27 more lines'), 'the elision is reported honestly');
    assert.ok(DEFAULT_MAX_ENTRIES <= 20 && DEFAULT_MAX_STACK_LINES <= 20, 'defaults are chat-sized');
  });

  it('an empty log reports honestly instead of an empty blob', () => {
    const text = buildErrorReport([], { generatedAt: GENERATED });
    assert.ok(text.includes('Entries: 0 (newest first)'));
    assert.ok(text.includes('No errors recorded.'));
  });

  it('a resolved entry does not count as unresolved', () => {
    const text = buildErrorReport(
      [
        { message: 'a', status: 'resolved' },
        { message: 'b', status: 'new' },
      ],
      { generatedAt: GENERATED },
    );
    assert.ok(text.includes('Unresolved: 1'));
  });
});

describe('the section is wired end to end', () => {
  const page = read('src/app/dashboard/admin/error-logs/page.tsx');
  const health = read('src/app/api/admin/platform-health/route.ts');
  const dashboard = read('src/app/dashboard/admin/page.tsx');
  const api = read('src/app/api/error-log/route.ts');

  it('the dead stub is now a real error center with copy-to-clipboard', () => {
    assert.equal(page.includes('Section Removed'), false, 'stub is gone');
    assert.equal(page.includes('System diagnostics are restricted'), false, 'stub copy is gone');
    assert.ok(page.includes('buildErrorReport'), 'copies the shared report builder');
    assert.ok(page.includes('navigator.clipboard'), 'offers clipboard copy');
    assert.ok(page.includes('AdminLayout'), 'stays an admin surface');
    assert.ok(page.includes("orderBy('timestamp', 'desc')"), 'newest first');
  });

  it('the API\u2019s report link lands on this section and the param is honoured', () => {
    assert.ok(api.includes('/dashboard/admin/error-logs?filter='));
    assert.ok(page.includes('window.location.search'), '?filter= is read');
    assert.ok(page.includes("startsWith('report-')"), 'only report links are accepted');
  });

  it('the platform-health AI signal links to a route that exists', () => {
    assert.equal(health.includes('ai-management'), false, 'no more 404 link');
    assert.ok(health.includes('/dashboard/admin/ai/center'), 'points at the real AI center');
  });

  it('the admin dashboard offers the section', () => {
    assert.ok(dashboard.includes("label: 'Error center'"));
    assert.ok(dashboard.includes("href: '/dashboard/admin/error-logs'"));
  });
});
