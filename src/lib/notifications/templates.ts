/**
 * VIDNOV Email templates — data-only definitions.
 *
 * Templates are plain text/HTML with {{var}} placeholders. Rendering is a
 * whitelist substitution (see renderer.ts): unknown vars become empty strings
 * and nothing is ever executed, so templates stay inert data.
 */

export interface EmailTemplateDef {
  key: string;
  subject: string;
  category: 'account' | 'orders' | 'bookings' | 'messages' | 'payments' | 'ai' | 'media' | 'business' | 'marketing';
  /** Plain-text body with {{vars}}. */
  body: string;
  /** Vars this template expects (documentation + admin UI). */
  vars: string[];
}

const SHARED_FOOTER = '\n\n—\nThe Vidnov Team\n{{support_email}}';

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  // ============ ACCOUNT / SECURITY (mandatory delivery) ============
  {
    key: 'welcome',
    subject: 'Welcome to Vidnov, {{user_name}}',
    category: 'account',
    vars: ['user_name', 'verification_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nWelcome to Vidnov — the marketplace where videos sell and businesses move.\n\nConfirm your email to activate your account:\n{{verification_link}}\n\nOnce confirmed you can discover local businesses, place orders and go live.' + SHARED_FOOTER,
  },
  {
    key: 'verify-email',
    subject: 'Confirm your Vidnov email',
    category: 'account',
    vars: ['user_name', 'verification_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nPlease confirm your email address to finish setting up your Vidnov account:\n{{verification_link}}\n\nIf you didn’t create an account, you can safely ignore this email.' + SHARED_FOOTER,
  },
  {
    key: 'password-reset',
    subject: 'Reset your Vidnov password',
    category: 'account',
    vars: ['user_name', 'reset_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nWe received a request to reset your Vidnov password. This link works once and expires in 60 minutes:\n{{reset_link}}\n\nIf you didn’t request this, your account is safe — the link can only be used by whoever has access to this inbox.' + SHARED_FOOTER,
  },
  {
    key: 'password-changed',
    subject: 'Your Vidnov password was changed',
    category: 'account',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour Vidnov password was just changed. If this was you, no action is needed.\n\nIf you didn’t change it, reset your password immediately and contact support: {{support_email}}' + SHARED_FOOTER,
  },
  {
    key: 'new-login',
    subject: 'New sign-in to your Vidnov account',
    category: 'account',
    vars: ['user_name', 'device', 'location', 'created_at', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nThere was a new sign-in to your Vidnov account.\n\nDevice: {{device}}\nLocation: {{location}}\nTime: {{created_at}}\n\nManage your active sessions in Settings → Security.' + SHARED_FOOTER,
  },
  {
    key: 'account-recovery',
    subject: 'Your Vidnov account was recovered',
    category: 'account',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour account access has been restored. If you have any trouble signing in, reply to this email or contact {{support_email}}.' + SHARED_FOOTER,
  },
  {
    key: 'account-deactivated',
    subject: 'Your Vidnov account was deactivated',
    category: 'account',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour Vidnov account has been deactivated at your request. You can reactivate it any time by signing in.' + SHARED_FOOTER,
  },
  {
    key: 'email-changed',
    subject: 'Your Vidnov email was changed',
    category: 'account',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nThe email address on your Vidnov account was changed. If this wasn’t you, contact {{support_email}} immediately.' + SHARED_FOOTER,
  },
  {
    key: 'security-alert',
    subject: 'Security alert for your Vidnov account',
    category: 'account',
    vars: ['user_name', 'device', 'location', 'created_at', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nWe noticed unusual activity on your account.\n\nDevice: {{device}}\nLocation: {{location}}\nTime: {{created_at}}\n\nIf this wasn’t you, secure your account now from Settings → Security.' + SHARED_FOOTER,
  },

  // ============ CUSTOMER / ORDERS ============
  {
    key: 'order-confirmation',
    subject: 'Order {{order_number}} confirmed',
    category: 'orders',
    vars: ['user_name', 'order_number', 'amount', 'currency', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour order {{order_number}} is confirmed.\n\nTotal: {{currency}} {{amount}}\n\nTrack it any time from your Vidnov account.' + SHARED_FOOTER,
  },
  {
    key: 'order-status',
    subject: 'Order {{order_number}} — status update',
    category: 'orders',
    vars: ['user_name', 'order_number', 'status', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour order {{order_number}} is now: {{status}}.\n\nOpen the app for live delivery tracking.' + SHARED_FOOTER,
  },
  {
    key: 'booking-confirmation',
    subject: 'Booking {{booking_number}} confirmed',
    category: 'bookings',
    vars: ['user_name', 'booking_number', 'created_at', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour booking {{booking_number}} is confirmed for {{created_at}}.\n\nManage it from your Vidnov account.' + SHARED_FOOTER,
  },
  {
    key: 'booking-reminder',
    subject: 'Reminder: booking {{booking_number}}',
    category: 'bookings',
    vars: ['user_name', 'booking_number', 'created_at', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nA quick reminder about your booking {{booking_number}} on {{created_at}}.' + SHARED_FOOTER,
  },
  {
    key: 'payment-confirmation',
    subject: 'Payment received — {{currency}} {{amount}}',
    category: 'payments',
    vars: ['user_name', 'amount', 'currency', 'order_number', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nWe received your payment of {{currency}} {{amount}} for order {{order_number}}. Thank you.' + SHARED_FOOTER,
  },
  {
    key: 'refund-notification',
    subject: 'Refund issued for order {{order_number}}',
    category: 'payments',
    vars: ['user_name', 'order_number', 'amount', 'currency', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nA refund of {{currency}} {{amount}} for order {{order_number}} is on its way. It usually lands within 5 business days.' + SHARED_FOOTER,
  },
  {
    key: 'important-message',
    subject: 'New message on Vidnov',
    category: 'messages',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYou’ve received a new message on Vidnov. Open your inbox to read and reply.' + SHARED_FOOTER,
  },

  // ============ BUSINESS ============
  {
    key: 'business-registration',
    subject: 'Your Vidnov business account is set up',
    category: 'business',
    vars: ['user_name', 'business_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{business_name}} is ready on Vidnov. Add your first listing and go live to start selling.' + SHARED_FOOTER,
  },
  {
    key: 'business-approved',
    subject: '{{business_name}} is verified',
    category: 'business',
    vars: ['user_name', 'business_name', 'app_url', 'support_email'],
    body:
      'Congratulations {{user_name}} — {{business_name}} is now a verified Vidnov business. You get the verified badge, better discovery placement and payouts.' + SHARED_FOOTER,
  },
  {
    key: 'new-order',
    subject: 'New order on {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'order_number', 'amount', 'currency', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{business_name}} received a new order ({{order_number}}) worth {{currency}} {{amount}}. Prepare it for dispatch.' + SHARED_FOOTER,
  },
  {
    key: 'new-booking',
    subject: 'New booking on {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'booking_number', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{business_name}} received a new booking ({{booking_number}}). Confirm it from your dashboard.' + SHARED_FOOTER,
  },
  {
    key: 'new-customer-message',
    subject: 'New customer message — {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nA customer messaged {{business_name}}. Reply quickly — fast replies convert 3× better.' + SHARED_FOOTER,
  },
  {
    key: 'payment-received',
    subject: 'Payment received for {{business_name}}',
    category: 'payments',
    vars: ['user_name', 'business_name', 'amount', 'currency', 'order_number', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{currency}} {{amount}} for order {{order_number}} was received and is being processed to your wallet.' + SHARED_FOOTER,
  },
  {
    key: 'listing-approved',
    subject: 'Listing approved — {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'product_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n“{{product_name}}” on {{business_name}} passed review and is now live in discovery.' + SHARED_FOOTER,
  },
  {
    key: 'listing-rejected',
    subject: 'Listing needs changes — {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'product_name', 'reason', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n“{{product_name}}” on {{business_name}} needs changes before it can go live.\n\nReason: {{reason}}\n\nEdit and resubmit from your dashboard.' + SHARED_FOOTER,
  },
  {
    key: 'new-review',
    subject: 'New review for {{business_name}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'product_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nSomeone left a review on “{{product_name}}”. See what they said from your dashboard.' + SHARED_FOOTER,
  },

  // ============ AI STUDIO ============
  {
    key: 'generation-started',
    subject: 'Your Vidnov AI generation started',
    category: 'ai',
    vars: ['user_name', 'product_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour AI generation{{#product_name}} for “{{product_name}}”{{/product_name}} is running. We’ll email you when it’s ready.' + SHARED_FOOTER,
  },
  {
    key: 'generation-complete',
    subject: 'Your Vidnov AI generation is ready',
    category: 'ai',
    vars: ['user_name', 'product_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour AI generation{{#product_name}} for “{{product_name}}”{{/product_name}} is ready. Open AI Studio to view and publish it.' + SHARED_FOOTER,
  },
  {
    key: 'generation-failed',
    subject: 'Your Vidnov AI generation couldn’t finish',
    category: 'ai',
    vars: ['user_name', 'reason', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour AI generation didn’t finish ({{reason}}). You weren’t charged. Try again from AI Studio.' + SHARED_FOOTER,
  },
  {
    key: 'ai-points-update',
    subject: 'Your Vidnov AI points were updated',
    category: 'ai',
    vars: ['user_name', 'amount', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour AI points balance changed by {{amount}}. Open your dashboard to see the current balance.' + SHARED_FOOTER,
  },

  // ============ MEDIA ============
  {
    key: 'upload-complete',
    subject: 'Your media finished processing',
    category: 'media',
    vars: ['user_name', 'media_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n“{{media_name}}” finished processing and is optimized for the marketplace.' + SHARED_FOOTER,
  },
  {
    key: 'backup-complete',
    subject: 'Media backup complete',
    category: 'media',
    vars: ['user_name', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour media library backup completed successfully.' + SHARED_FOOTER,
  },
  {
    key: 'sync-failed',
    subject: 'Media sync failed',
    category: 'media',
    vars: ['user_name', 'reason', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nA media sync didn’t finish ({{reason}}). You can retry from My Media.' + SHARED_FOOTER,
  },
  {
    key: 'storage-warning',
    subject: 'Vidnov storage warning',
    category: 'media',
    vars: ['user_name', 'reason', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nStorage attention needed: {{reason}}. Free up space or upgrade to keep everything running.' + SHARED_FOOTER,
  },

  // ============ REQUEST MARKETPLACE ============
  {
    key: 'new-matched-request',
    subject: 'New request matches your business — {{request_title}}',
    category: 'business',
    vars: ['user_name', 'business_name', 'request_title', 'request_category', 'request_location', 'budget', 'request_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nA new request matches what {{business_name}} offers:\n\n“{{request_title}}”\nCategory: {{request_category}}\nLocation: {{request_location}}\nBudget: {{budget}}\n\nReview the full details and send an offer before other businesses do:\n{{request_link}}' + SHARED_FOOTER,
  },
  {
    key: 'offer-received',
    subject: 'New offer on “{{request_title}}”',
    category: 'orders',
    vars: ['user_name', 'business_name', 'request_title', 'amount', 'currency', 'offer_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{business_name}} sent an offer on your request “{{request_title}}”:\n\n{{currency}} {{amount}}\n\nCompare all offers and choose the best fit:\n{{offer_link}}' + SHARED_FOOTER,
  },
  {
    key: 'offer-accepted',
    subject: 'Your offer was accepted — {{request_title}}',
    category: 'orders',
    vars: ['user_name', 'business_name', 'request_title', 'amount', 'currency', 'order_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\n{{business_name}} accepted your {{currency}} {{amount}} offer for “{{request_title}}”.\n\nNext step: confirm the details, deliver, and get paid:\n{{order_link}}' + SHARED_FOOTER,
  },
  {
    key: 'request-closed',
    subject: 'Your request “{{request_title}}” has an accepted offer',
    category: 'orders',
    vars: ['user_name', 'request_title', 'business_name', 'amount', 'currency', 'order_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYou accepted {{business_name}}’s {{currency}} {{amount}} offer for “{{request_title}}”.\n\nTrack the order from Requests → My Requests:\n{{order_link}}' + SHARED_FOOTER,
  },
  {
    key: 'request-expiring',
    subject: 'Your request “{{request_title}}” expires {{expires_on}}',
    category: 'business',
    vars: ['user_name', 'request_title', 'expires_on', 'offers_count', 'request_link', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour request “{{request_title}}” stops accepting offers on {{expires_on}}.\n\nOffers received so far: {{offers_count}}. Renew it to keep businesses responding:\n{{request_link}}\n\nAfter it expires you can renew it in one tap — it stays visible to matched businesses for another 30 days.' + SHARED_FOOTER,
  },
  // ============ SHOP OPPORTUNITY AGENT ============
  {
    // The Shop Opportunity Agent supplies the full, pre-reviewed body as
    // `content` (personalised invitation + sender identity + opt-out link).
    // The template exists so outreach flows through the SAME email service
    // as every other transactional message: provider dispatch, per-recipient
    // rate limits and the emailLogs delivery trail all apply unchanged.
    key: 'seller-invitation',
    subject: 'Invitation to sell on Vidnov',
    category: 'business',
    vars: ['business_name', 'content'],
    body: '{{content}}',
  },
  // ============ GROWTH POSTS (nightly draft engine) ============
  {
    // The Growth Post engine sends an APPROVED, ready-made social caption
    // to the product's own seller so they can post it as-is. The body is
    // assembled from the real product record + the drafted caption, and it
    // travels through the same email service as every other transactional
    // message: provider dispatch, per-recipient rate limits and the
    // emailLogs delivery trail all apply unchanged.
    key: 'growth-post',
    subject: 'A ready-made post for {{product_name}}',
    category: 'business',
    vars: ['seller_name', 'product_name', 'caption', 'share_url', 'support_email'],
    body:
      'Hi {{seller_name}},\n\nOur growth engine drafted a social post for {{product_name}} — copy it as-is and share it on your channels:\n\n---\n{{caption}}\n---\n\nYour listing (tracked link):\n{{share_url}}\n\nSharing it keeps your shop in front of buyers already browsing Vidnov. Nothing is ever posted on your behalf.' + SHARED_FOOTER,
  },
  // ============ SUPPORT TICKETS ============
  {
    // Acknowledgement to the person who opened the ticket. Sent through the
    // same email service as everything else: rate limits, suppression and
    // the emailLogs trail all apply unchanged. No response-time promise is
    // invented — only what actually happened is stated.
    key: 'support-ticket-received',
    subject: 'We received your support ticket',
    category: 'messages',
    vars: ['user_name', 'issue_type', 'ticket_ref', 'app_url', 'support_email'],
    body:
      'Hi {{user_name}},\n\nYour support ticket has reached our team.\n\nTopic: {{issue_type}}\nReference: {{ticket_ref}}\n\nWe have the details you sent and will reply by email — there is no need to submit it again.' + SHARED_FOOTER,
  },
  {
    // Administrator notification — goes to the configured admin mailbox.
    key: 'support-ticket-alert',
    subject: 'New support ticket: {{issue_type}}',
    category: 'messages',
    vars: ['user_name', 'issue_type', 'ticket_ref', 'description', 'app_url', 'support_email'],
    body:
      'New support ticket received.\n\nFrom: {{user_name}}\nTopic: {{issue_type}}\nReference: {{ticket_ref}}\n\nDetails:\n{{description}}\n\nOpen Support → Tickets in the admin dashboard to respond.' + SHARED_FOOTER,
  },
];

/** Finds a template by key; callers can rely on a missing key being undefined. */
export function getTemplate(key: string): EmailTemplateDef | undefined {
  return EMAIL_TEMPLATES.find(t => t.key === key);
}
