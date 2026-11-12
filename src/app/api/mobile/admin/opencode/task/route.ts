/**
 * GET /api/mobile/admin/opencode/task?id=…
 *
 * Returns one stored task plus the current OpenCode status, todos, changed
 * files, tool output and test results. The status is re-derived from the live
 * session on every read; the phone polls this route while a task is running.
 */
import type { NextRequest } from 'next/server';

import { db } from '@/firebase/server';
import { adminGate, json } from '@/lib/admin-ai/http';
import { getOpenCodeTask, syncOpenCodeTask } from '@/lib/admin-ai/opencode';
import { publicError } from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!id) return json({ error: 'id is required.' }, 400);

  try {
    const task = await getOpenCodeTask(db, id);
    if (!task) return json({ error: 'Task not found.' }, 404);
    const detail = await syncOpenCodeTask(db, task);
    return json(detail);
  } catch (error) {
    console.error('[opencode] task detail failed', error);
    return json({ error: publicError(error) }, 502);
  }
}
