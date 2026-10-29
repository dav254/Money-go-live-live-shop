/**
 * GROWTH POSTS — AI drafting adapter (routes/cron only, NOT test-imported).
 *
 * The single network touchpoint of the engine: one bounded chat completion
 * against the Gemini REST API the repo already uses for image/video jobs
 * (`GEMINI_API_KEY`, same API root as `lib/ai/gemini-adapter`), asking for
 * strict-JSON social copy about ONE product.
 *
 * Honesty rules:
 *   • No key  → `not_configured`. Nothing is called, nothing is spent.
 *   • A bad/empty reply → `failed`. It is reported as a failure and NEVER
 *     saved as a draft — the queue only ever holds real generated copy.
 *   • Provider error bodies are sanitized before they can reach a record or
 *     a log (same helper the distribution engine uses).
 *   • The response is validated by the PURE parser in `drafts.ts`, so this
 *     file holds no parsing logic of its own.
 */

import { sanitizeErrorMessage } from '../distribution/job-utils';
import { buildDraftPrompt, parseDraftResponse, type DraftCandidate, type ParsedDraft } from './drafts';

const API_ROOT = 'https://generativelanguage.googleapis/v1beta';
/** The model family already used elsewhere in this repo (see src/ai/genkit.ts). */
const TEXT_MODEL = 'gemini-2.5-flash';

export type DraftOutcome =
  | { ok: true; draft: ParsedDraft }
  | { ok: false; code: 'not_configured' | 'failed'; message: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function draftSocialPost(
  candidate: DraftCandidate,
  sharePath: string,
  env: Record<string, string | undefined> = process.env,
  fetchLike: FetchLike = (input, init) => fetch(input, init),
): Promise<DraftOutcome> {
  const key = (env.GEMINI_API_KEY ?? '').trim();
  if (!key) {
    return { ok: false, code: 'not_configured', message: 'GEMINI_API_KEY is not configured.' };
  }

  try {
    const res = await fetchLike(`${API_ROOT}/models/${TEXT_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildDraftPrompt(candidate, sharePath) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      return { ok: false, code: 'failed', message: `Draft request rejected (${res.status}).` };
    }

    const data = (await res.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> | null;
    } | null;
    const text = (data?.candidates ?? [])
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      return { ok: false, code: 'failed', message: 'Draft response contained no text.' };
    }

    const draft = parseDraftResponse(text);
    return { ok: true, draft };
  } catch (error) {
    // Sanitized — an upstream body never reaches a record or a log.
    return { ok: false, code: 'failed', message: sanitizeErrorMessage(error) };
  }
}
