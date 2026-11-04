/**
 * ORBIT — model configuration status (task §H).
 *
 * The founder will connect a model later. Until then the headquarters must
 * say MODEL_NOT_CONFIGURED, out loud, everywhere — never run on a fake key and
 * never imply that reasoning is happening when it is not.
 *
 * Only variable NAMES are inspected. A value is never read into a response,
 * logged, or compared to anything: presence is the whole test.
 */

export const MODEL_ENV = {
  provider: 'HERMES_MODEL_PROVIDER',
  model: 'HERMES_MODEL',
  apiKey: 'HERMES_MODEL_API_KEY',
} as const;

export const MODEL_STATES = ['MODEL_NOT_CONFIGURED', 'MODEL_CONFIGURED'] as const;
export type ModelState = (typeof MODEL_STATES)[number];

export interface ModelStatus {
  state: ModelState;
  configured: boolean;
  /** Provider id (e.g. `gemini`, `openai`, `nous-portal`) — never a key. */
  provider?: string;
  /** Model id, e.g. `gemini-2.5-pro`. */
  model?: string;
  /** Env variable NAMES still missing. Names only. */
  missing: string[];
  note: string;
}

const SAFE_TOKEN = /^[a-z0-9][a-z0-9._-]{0,48}$/i;

export function modelStatus(env: Record<string, string | undefined> = process.env): ModelStatus {
  const provider = (env[MODEL_ENV.provider] ?? '').trim();
  const model = (env[MODEL_ENV.model] ?? '').trim();
  const key = (env[MODEL_ENV.apiKey] ?? '').trim();

  const missing: string[] = [];
  if (!provider) missing.push(MODEL_ENV.provider);
  if (!key) missing.push(MODEL_ENV.apiKey);

  if (missing.length > 0) {
    return {
      state: 'MODEL_NOT_CONFIGURED',
      configured: false,
      missing,
      note:
        'No AI model is connected. Agents are registered and tasks can be routed, but reasoning is unavailable until a provider key is added.',
    };
  }

  return {
    state: 'MODEL_CONFIGURED',
    configured: true,
    // Echo only a safe identifier — a mistyped key in the provider field must
    // not be reflected back to a client.
    provider: SAFE_TOKEN.test(provider) ? provider : 'custom',
    model: SAFE_TOKEN.test(model) ? model : undefined,
    missing: [],
    note: 'A provider is configured. Run one real task end to end before calling reasoning operational.',
  };
}
