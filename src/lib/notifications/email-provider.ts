/**
 * VIDNOV email provider abstraction.
 *
 * The EmailService depends only on this interface, so switching provider
 * (Resend → Postmark → SMTP) is an environment change, not a rebuild.
 *
 * Supported providers:
 *  - console (default): logs the message — useful when no keys exist yet.
 *  - resend:   EMAIL_PROVIDER=resend   EMAIL_API_KEY=re_...
 *  - postmark: EMAIL_PROVIDER=postmark EMAIL_API_KEY=...
 *  - sendgrid: EMAIL_PROVIDER=sendgrid EMAIL_API_KEY=SG....
 */

export interface OutgoingEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  /** Structured id used to correlate delivery events with the send. */
  templateKey?: string;
}

export interface SendResult {
  /** Provider message id when the provider accepted the send. */
  providerId?: string;
  accepted: boolean;
  error?: string;
}

export interface EmailProvider {
  readonly id: string;
  send(email: OutgoingEmail): Promise<SendResult>;
}

// ---------------------------------------------------------------------------
// Console provider — dev fallback; never delivers, just records.
// ---------------------------------------------------------------------------
const consoleProvider: EmailProvider = {
  id: 'console',
  async send(email) {
    console.log(
      `[email:console] to=${email.to} from=${email.from} subject="${email.subject}" template=${email.templateKey ?? 'n/a'}`,
    );
    return { accepted: true, providerId: `console_${Date.now().toString(36)}` };
  },
};

// ---------------------------------------------------------------------------
// Resend — https://resend.com (simple REST API)
// ---------------------------------------------------------------------------
const resendProvider: EmailProvider = {
  id: 'resend',
  async send(email) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { accepted: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { accepted: true, providerId: data.id };
  },
};

// ---------------------------------------------------------------------------
// Postmark — https://postmarkapp.com
// ---------------------------------------------------------------------------
const postmarkProvider: EmailProvider = {
  id: 'postmark',
  async send(email) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': process.env.EMAIL_API_KEY ?? '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: email.from,
        To: email.to,
        ReplyTo: email.replyTo,
        Subject: email.subject,
        TextBody: email.text,
        HtmlBody: email.html,
        MessageStream: 'outbound',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { accepted: false, error: `postmark ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { MessageID?: string };
    return { accepted: true, providerId: data.MessageID };
  },
};

// ---------------------------------------------------------------------------
// SendGrid — https://sendgrid.com
// ---------------------------------------------------------------------------
const sendgridProvider: EmailProvider = {
  id: 'sendgrid',
  async send(email) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email.to }] }],
        from: { email: email.from },
        reply_to: email.replyTo ? { email: email.replyTo } : undefined,
        subject: email.subject,
        content: [
          { type: 'text/plain', value: email.text },
          { type: 'text/html', value: email.html },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { accepted: false, error: `sendgrid ${res.status}: ${body.slice(0, 200)}` };
    }
    return { accepted: true, providerId: res.headers.get('x-message-id') ?? undefined };
  },
};

/**
 * Resolves the provider for a configured name. Unknown or missing names fall
 * back to the console provider so the app never hard-crashes on mail.
 */
export function getEmailProvider(providerName: string | undefined, apiKey: string | undefined): EmailProvider {
  if (!providerName || !apiKey) return consoleProvider;
  switch (providerName.toLowerCase()) {
    case 'resend': return resendProvider;
    case 'postmark': return postmarkProvider;
    case 'sendgrid': return sendgridProvider;
    default: return consoleProvider;
  }
}
