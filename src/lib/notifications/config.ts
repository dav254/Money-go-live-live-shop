/**
 * VIDNOV Communication Engine — configuration.
 *
 * DOMAIN RULE: no domain is ever hard-coded. Every generated link uses
 * APP_URL; every sender address derives from EMAIL_FROM / MAIL_ADDRESSES.
 * Changing domains later is a pure environment change (see DEPLOY-AUTH.md).
 */

import { publicOrigin } from '@/lib/site-url';

export type EmailCategory =
  | 'account'
  | 'orders'
  | 'bookings'
  | 'messages'
  | 'payments'
  | 'ai'
  | 'media'
  | 'business'
  | 'marketing';

export interface VidnovConfig {
  /** Absolute base URL used for every generated link. */
  appUrl: string;
  /** Brand-facing application name used in templates. */
  appName: string;
  /** Default From address, e.g. customer@domain (from EMAIL_FROM). */
  emailFrom: string;
  /** Optional reply-to (defaults to EMAIL_REPLY_TO or support address). */
  emailReplyTo: string;
  /** Named role mailboxes — all derived from configuration, never hardcoded. */
  mailAddresses: Record<'customer' | 'support' | 'business' | 'payments' | 'admin', string>;
  /** development = capture into dev mailbox · production = real provider. */
  emailMode: 'development' | 'production';
  /** Provider id when EMAIL_MODE=production: resend | postmark | sendgrid | smtp. */
  emailProvider: string;
  /** Provider API key (read from env at call time, never inlined). */
  emailApiKey: string;
  /** Development recipient override — funnel all dev emails to one inbox. */
  devInbox: string;
}

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

/**
 * Public brand domain for OUTWARD-facing links (emails, share texts,
 * store listings). Internal testing keeps using APP_URL / NEXT_PUBLIC_APP_URL
 * (sandbox, localhost, preview…).
 *
 * The default lives in `@/lib/site-url` — one module owns the domain, so the
 * referral links, the share buttons and these emails cannot drift onto
 * different hosts. This file deliberately spells no domain of its own, which
 * is what `src/tests/security-rules.test.ts` ("domain hygiene") enforces.
 */
export const PUBLIC_APP_URL = (env('APP_PUBLIC_URL') || publicOrigin()).replace(/\/$/, '');

/** Domain extracted from EMAIL_FROM or APP_URL — used only for role aliases. */
function domainFromAddress(address: string, fallbackUrl: string): string {
  const from = address.split('@')[1];
  if (from) return from;
  try {
    return new URL(fallbackUrl).host;
  } catch {
    return 'localhost';
  }
}

let cached: VidnovConfig | null = null;

export function getVidnovConfig(): VidnovConfig {
  if (cached) return cached;

  const appUrl = env('APP_URL') || (env('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
  const emailFrom = env('EMAIL_FROM') || `customer@${domainFromAddress('', appUrl)}`;
  const domain = domainFromAddress(emailFrom, appUrl);

  cached = {
    appUrl,
    appName: 'Vidnov',
    emailFrom,
    emailReplyTo: env('EMAIL_REPLY_TO') || env('SUPPORT_EMAIL') || `support@${domain}`,
    mailAddresses: {
      customer: emailFrom,
      support: env('SUPPORT_EMAIL') || `support@${domain}`,
      business: env('BUSINESS_EMAIL') || `business@${domain}`,
      payments: env('PAYMENTS_EMAIL') || `payments@${domain}`,
      admin: env('ADMIN_EMAIL') || `admin@${domain}`,
    },
    emailMode: (env('EMAIL_MODE').toLowerCase() === 'production' ? 'production' : 'development'),
    emailProvider: env('EMAIL_PROVIDER') || '',
    emailApiKey: env('EMAIL_API_KEY') || '',
    devInbox: env('EMAIL_DEV_INBOX') || '',
  };
  return cached;
}

/**
 * Builds an absolute URL for emails & notifications. External-facing
 * links go to the PUBLIC domain (see `PUBLIC_APP_URL`); when the sandbox
 * flag is on (or APP_PUBLIC_URL=local) they stay on the internal APP_URL so
 * testing keeps working before the domain goes live.
 */
export function appLink(path: string): string {
  const { appUrl } = getVidnovConfig();
  const isLocalTest = /localhost|127\.0\.0\.1|\.e2b\.app/.test(appUrl);
  const base = isLocalTest ? appUrl : PUBLIC_APP_URL;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Which mailbox should carry a given category of mail. */
export function mailboxFor(category: EmailCategory): string {
  const { mailAddresses } = getVidnovConfig();
  switch (category) {
    case 'payments': return mailAddresses.payments;
    case 'business': return mailAddresses.business;
    case 'account': return mailAddresses.customer;
    default: return mailAddresses.support;
  }
}

/** True when security mail must be sent regardless of user preferences. */
export function isMandatoryCategory(category: EmailCategory): boolean {
  return category === 'account';
}
