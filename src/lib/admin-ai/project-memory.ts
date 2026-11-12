/**
 * Bounded project memory for Vidnov Intelligence.
 *
 * This is a read-only summary of decisions, reports and OpenCode outcomes that
 * already exist in the server stores. It is deliberately small: enough for the
 * model to remember what the founder approved and what actually finished,
 * without turning a chat request into a database dump.
 */
import { db } from '@/firebase/server';
import { listReports } from '@/lib/pocketbase/admin-ai';
import { listProposals } from '@/lib/ai-headquarters/proposals';
import type { ProposalRecord } from '@/lib/ai-headquarters/types';

import { listOpenCodeTasks } from './opencode';
import { cleanLine } from './validate';

export async function projectMemory(uid: string): Promise<string> {
  const [reports, proposals, tasks] = await Promise.all([
    listReports(uid, 6).catch(() => []),
    listProposals(db, { limit: 20 }).catch(() => [] as ProposalRecord[]),
    listOpenCodeTasks(db, 6),
  ]);

  const lines: string[] = [];
  if (reports.length) {
    lines.push('Recent generated reports:');
    for (const report of reports.slice(0, 6)) {
      lines.push(`- ${cleanLine(report.title, 120)} [${cleanLine(report.status, 30)}]`);
    }
  }
  const decisions = proposals.filter((proposal) => proposal.status !== 'pending').slice(0, 10);
  if (decisions.length) {
    lines.push('Recent founder decisions:');
    for (const proposal of decisions) {
      lines.push(
        `- ${cleanLine(proposal.title, 120)} [${proposal.status}] ${cleanLine(proposal.summary, 180)}`,
      );
    }
  }
  if (tasks.length) {
    lines.push('Recent OpenCode tasks:');
    for (const task of tasks.slice(0, 6)) {
      lines.push(
        `- ${cleanLine(task.title, 120)} [${task.status}] ${task.changedFileCount} files changed`,
      );
    }
  }
  return lines.length ? lines.join('\n') : 'No project history is stored yet.';
}
