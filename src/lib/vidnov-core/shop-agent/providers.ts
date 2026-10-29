/**
 * SHOP OPPORTUNITY AGENT — provider wiring (routes only, NOT test-imported).
 *
 * This is the only file in the module that touches real integrations, so the
 * rest of the engine stays pure/injectable and tests never need credentials:
 *
 *   • email     — the EXISTING email service (provider dispatch, per-
 *                 recipient rate limits, emailLogs trail) via the new
 *                 `seller-invitation` template. Development mode is reported
 *                 honestly as `dev_captured`, never as `sent`.
 *   • sms       — no provider exists in this codebase ⇒ `not_configured`.
 *   • whatsapp  — the repo's bridge is an admin-alert session over WhatsApp
 *                 Web, NOT an approved business-messaging API ⇒ outreach is
 *                 deliberately `not_configured` (no fake sends, no ToS
 *                 shortcuts).
 *   • poster    — fal.ai text-to-image (pay-per-generation, low cost) via the
 *                 existing AI Studio adapter, persisted into the media
 *                 library through `storeGeneratedImage`. Called ONLY from an
 *                 explicit, admin-confirmed action.
 *
 * Status strings are derived from actual configuration and mode — a key
 * existing is reported as `configured (unverified until first call)`, never
 * as `connected`.
 */

import { falTextToImage } from '@/lib/ai/fal-adapter';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { storeGeneratedImage } from '@/lib/media/service';
import { sanitizeErrorMessage } from '../distribution/job-utils';
import { scoutProviderStatus } from './scout';
import { mapEmailResult, type SendOutcome, type SendRequest } from './service';
import type { AssetRecord, OutreachChannel } from './types';

export interface OutreachProviderStatus {
  id: string;
  label: string;
  status: 'configured' | 'not_configured';
  /** Environment variable NAMES only — never values. */
  requiredEnvVars: string[];
  note: string;
}

export function outreachProviderStatuses(
  env: Record<string, string | undefined> = process.env,
): Record<string, OutreachProviderStatus> {
  const emailConfigured = Boolean(env.EMAIL_PROVIDER && env.EMAIL_API_KEY);
  const emailMode = env.EMAIL_MODE?.toLowerCase() === 'production' ? 'production' : 'development';

  return {
    scout: { ...scoutProviderStatus(env), note: scoutProviderStatus(env).note },
    email: {
      id: 'email',
      label: 'Email (transactional provider)',
      status: emailConfigured ? 'configured' : 'not_configured',
      requiredEnvVars: ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_MODE'],
      note: !emailConfigured
        ? 'No email provider credentials configured — outreach cannot send.'
        : emailMode === 'production'
          ? 'Provider credentials present and EMAIL_MODE=production. Delivery is verified per message from the provider response.'
          : 'Credentials present but EMAIL_MODE is development: messages are captured to the internal dev mailbox and recorded as dev_captured — NOT delivered.',
    },
    sms: {
      id: 'sms',
      label: 'SMS',
      status: 'not_configured',
      requiredEnvVars: [],
      note: 'No SMS provider is integrated in this codebase. SMS messages can be drafted and approved but cannot send — recorded as not_configured, never as sent.',
    },
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp Business',
      status: 'not_configured',
      requiredEnvVars: [],
      note: "The repository's WhatsApp bridge is an admin-alert session over WhatsApp Web. No approved business-messaging API is integrated, so WhatsApp outreach is deliberately not operational.",
    },
    poster: {
      id: 'fal',
      label: 'Poster generation (fal.ai text-to-image)',
      status: env.FAL_KEY ? 'configured' : 'not_configured',
      requiredEnvVars: ['FAL_KEY'],
      note: env.FAL_KEY
        ? 'Key present (pay-per-generation). Reachability is confirmed on the first admin-triggered generation — a key existing is not a connection.'
        : 'FAL_KEY missing — poster generation reports not_configured and does not spend anything.',
    },
    video: {
      id: 'video',
      label: 'Promotional video generation',
      status: 'not_configured',
      requiredEnvVars: ['FAL_KEY'],
      note: 'Disabled by policy for outreach: video cost per clip is materially higher and no budget approval exists. Asset state stays `disabled` until explicitly approved.',
    },
  };
}

/**
 * Dispatches ONE approved outreach message. Email goes through the real
 * email service; every other channel returns an honest `not_configured`
 * outcome that the service records as a non-retryable failure.
 */
export async function dispatchOutreach(req: SendRequest): Promise<SendOutcome> {
  if (req.channel !== 'email') {
    return {
      kind: 'not_configured',
      message: `No ${req.channel} provider is integrated — this message cannot be sent.`,
    };
  }
  try {
    const result = await sendTemplateEmail({
      templateKey: 'seller-invitation',
      vars: { business_name: req.candidateId, content: req.body },
      category: 'business',
      to: req.to,
      subjectOverride: req.subject,
    });
    return mapEmailResult(result);
  } catch (err) {
    return { kind: 'error', message: sanitizeErrorMessage(err) };
  }
}

export type PosterResult = AssetRecord;

/**
 * Generates the Vidnov-branded poster mockup for ONE package. Explicitly
 * admin-confirmed (the route enforces `confirm: true`) so a paid generation
 * can never be triggered accidentally or by a script.
 */
export async function generateOutreachPoster(
  prompt: string,
  actorUid: string,
  env: Record<string, string | undefined> = process.env,
): Promise<PosterResult> {
  if (!env.FAL_KEY) {
    return {
      state: 'not_configured',
      url: null,
      mediaId: null,
      provider: 'fal',
      at: null,
      note: 'FAL_KEY is not configured — no generation attempted, nothing spent.',
    };
  }
  try {
    const image = await falTextToImage({ prompt, aspectRatio: '9:16', quality: 'standard' });
    const stored = await storeGeneratedImage(image.imageBuffer, actorUid, 'png');
    return {
      state: 'generated',
      url: stored.url,
      mediaId: stored.mediaId,
      provider: `fal:${image.model}`,
      at: new Date().toISOString(),
      note: 'AI-generated mockup — awaits admin approval before any use in outreach.',
    };
  } catch (err) {
    return {
      state: 'failed',
      url: null,
      mediaId: null,
      provider: 'fal',
      at: new Date().toISOString(),
      note: sanitizeErrorMessage(err),
    };
  }
}

/** Channel label helper for UI/report text. */
export function channelLabel(channel: OutreachChannel): string {
  return channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp';
}
