/**
 * GET /api/mobile/admin/ollama
 *
 * Measurements only: version, installed models, whether the configured model
 * is among them, latency and the last error. The base URL and API key stay on
 * the server, so this payload is safe for the phone.
 */
import type { NextRequest } from 'next/server';
import { adminGate, json } from '@/lib/admin-ai/http';
import { probeOllama } from '@/lib/admin-ai/ollama';
import { lastOllamaSuccess } from '@/lib/admin-ai/status';
import { publicError } from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  try {
    const status = await probeOllama();
    const lastOkAt = await lastOllamaSuccess().catch(() => null);
    return json({ ...status, lastOkAt });
  } catch (error) {
    console.error('[admin-ai/ollama] probe failed', error);
    return json(
      {
        configured: true,
        state: 'offline',
        reachable: false,
        version: null,
        models: [],
        activeModel: 'unknown',
        activeModelInstalled: false,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        lastOkAt: null,
        error: publicError(error),
      },
      200,
    );
  }
}
