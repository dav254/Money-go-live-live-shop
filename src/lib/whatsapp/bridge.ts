/**
 * WHATSAPP ADMIN ALERTS — the WhatsApp-native way to be told what's happening.
 *
 * The admin gets order and payment alerts as ordinary WhatsApp messages on
 * their own phone — the same "it just buzzes" experience as a person messaging
 * them — without any third-party SMS/push vendor. The whole bridge runs inside
 * this server process (on the VPS): it logs into WhatsApp Web through Baileys,
 * keeps the session in `.whatsapp-sessions/<uid>/` on disk, and messages the
 * paired account itself.
 *
 * ## Why self-chat
 *
 * `sendMessage(<my own jid>)` delivers into the admin's own WhatsApp account
 * (the "message yourself" chat every account has). That means pairing a phone
 * is enough — there is no recipient list to configure, no group to create, and
 * the alerts arrive exactly where the admin already looks all day. Pair a
 * second admin's phone and they get their own copy; every connected device is
 * independent and can be logged out on its own.
 *
 * ## Honest caveat
 *
 * Baileys speaks the WhatsApp Web protocol without Meta's official Business
 * API. It is free and self-hosted, which is exactly why it is used here — but
 * it is unofficial: volume should stay low (a handful of alert messages per
 * day is nothing; blast-marketing from this number would risk a ban), and
 * Meta's official API remains the "guaranteed" paid alternative.
 *
 * ## Process model
 *
 * One socket per admin uid, held on `globalThis` so dev-server module reloads
 * do not leak sockets. The socket owns its own reconnect loop; the state
 * machine (`connecting → qr → ready`) is what the pairing screen polls.
 */

import { promises as fs } from 'fs';
import path from 'path';

export type WhatsAppState = 'idle' | 'connecting' | 'qr' | 'ready' | 'error';

export interface WhatsAppStatus {
  state: WhatsAppState;
  /** Data-URL PNG of the pairing QR — only while `state === 'qr'`. */
  qr?: string;
  error?: string;
  /** Phone number the session is paired with, once connected. */
  pairedWith?: string;
}

interface SocketEntry {
  state: WhatsAppState;
  // Baileys' socket type is intentionally not imported here: the module must
  // load cheaply (it is imported by payment webhooks) and only the bridge
  // ever talks to the socket.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock: any;
  qr?: string;
  error?: string;
  pairedWith?: string;
  stopped?: boolean;
}

// One entry per paired admin, surviving module reloads.
const globalStore = globalThis as Record<string, unknown>;
if (!globalStore.__vidnovWhatsApp) {
  globalStore.__vidnovWhatsApp = new Map<string, SocketEntry>();
}
const registry = globalStore.__vidnovWhatsApp as Map<string, SocketEntry>;

const SESSION_ROOT = path.join(process.cwd(), '.whatsapp-sessions');

/** Minimal silent pino-alike; Baileys logs verbosely otherwise. */
const silentLogger = {
  level: 'silent',
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

function toStatus(entry: SocketEntry | undefined): WhatsAppStatus {
  if (!entry) return { state: 'idle' };
  return {
    state: entry.state,
    qr: entry.state === 'qr' ? entry.qr : undefined,
    error: entry.error,
    pairedWith: entry.pairedWith,
  };
}

export function whatsappStatusFor(uid: string): WhatsAppStatus {
  return toStatus(registry.get(uid));
}

/** True when at least one admin phone is paired — used to skip work entirely. */
export function isWhatsAppAlertingEnabled(): boolean {
  for (const entry of registry.values()) {
    if (entry.state === 'ready') return true;
  }
  return false;
}

/**
 * Pairs (or re-pairs) this admin's WhatsApp. Returns the live status; the QR
 * typically materialises within a few seconds, so the caller polls
 * `whatsappStatusFor` until `state` leaves `connecting`.
 */
export async function connectWhatsAppFor(uid: string): Promise<WhatsAppStatus> {
  const existing = registry.get(uid);
  if (existing && existing.state !== 'error' && !existing.stopped) {
    return toStatus(existing);
  }

  const entry: SocketEntry = {
    state: 'connecting',
    sock: null,
    stopped: false,
  };
  registry.set(uid, entry);

  // Fire and forget: the socket announces itself through the state machine.
  void startSocket(uid, entry).catch((err) => {
    entry.state = 'error';
    entry.error = err instanceof Error ? err.message : 'Could not start WhatsApp connection.';
  });

  return toStatus(entry);
}

async function startSocket(uid: string, entry: SocketEntry): Promise<void> {
  const baileys = await import('@whiskeysockets/baileys');
  const QRCode = await import('qrcode');

  const sessionDir = path.join(SESSION_ROOT, uid);
  await fs.mkdir(sessionDir, { recursive: true });
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionDir);

  const sock = baileys.makeWASocket({
    auth: state,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: silentLogger as any,
    markOnlineOnConnect: false,
    // Standard browser identity; the phone shows "WhatsApp Web" linked.
    browser: ['Vidnov Admin Alerts', 'Chrome', '1.0.0'],
  });
  entry.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      entry.state = 'qr';
      entry.qr = await QRCode.toDataURL(qr);
      entry.error = undefined;
    }

    if (connection === 'open') {
      entry.state = 'ready';
      entry.qr = undefined;
      entry.error = undefined;
      entry.pairedWith = (sock.user?.id || '').split(':')[0] || undefined;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === baileys.DisconnectReason.loggedOut;

      if (entry.stopped || loggedOut) {
        entry.state = 'idle';
        entry.sock = null;
        return;
      }

      // Transient drop (network, phone offline): reconnect once the caller's
      // loop keeps it simple — restart the socket after a short pause.
      entry.state = 'connecting';
      setTimeout(() => {
        if (!entry.stopped) {
          void startSocket(uid, entry).catch((err) => {
            entry.state = 'error';
            entry.error =
              err instanceof Error ? err.message : 'Could not reconnect WhatsApp.';
          });
        }
      }, 3_000);
    }
  });
}

/** Logs this admin out on both sides and forgets the session on disk. */
export async function disconnectWhatsAppFor(uid: string): Promise<WhatsAppStatus> {
  const entry = registry.get(uid);
  if (entry) {
    entry.stopped = true;
    try {
      await entry.sock?.logout();
    } catch {
      // Already gone — clearing the session below is what matters.
    }
    try {
      entry.sock?.end?.(undefined);
    } catch {
      // ignore
    }
    registry.delete(uid);
  }
  await fs.rm(path.join(SESSION_ROOT, uid), { recursive: true, force: true });
  return { state: 'idle' };
}

/**
 * Sends `text` to every paired admin (each into their own WhatsApp chat).
 * Never throws — this is called from payment and order paths that must not
 * fail because WhatsApp was briefly unreachable.
 */
export async function broadcastAdminAlert(
  title: string,
  body: string,
): Promise<number> {
  let sent = 0;
  const message = `*${title}*\n${body}\n\n— Vidnov Admin`;

  for (const entry of registry.values()) {
    if (entry.state !== 'ready' || !entry.sock) continue;
    try {
      const jid = entry.sock.user?.id;
      if (!jid) continue;
      // `jidNormalizedUser` strips the device suffix so the message lands in
      // the account's own "message yourself" chat.
      const { jidNormalizedUser } = await import('@whiskeysockets/baileys');
      await entry.sock.sendMessage(jidNormalizedUser(jid), { text: message });
      sent += 1;
    } catch (err) {
      console.warn('[whatsapp] alert send failed:', err);
    }
  }
  return sent;
}

/** Sends a test alert to this admin's own paired session. */
export async function sendTestAlertTo(uid: string): Promise<boolean> {
  const entry = registry.get(uid);
  if (!entry || entry.state !== 'ready' || !entry.sock) {
    throw new Error('This phone is not connected yet — scan the QR first.');
  }
  const jid = entry.sock.user?.id;
  if (!jid) throw new Error('WhatsApp session is not fully open yet.');
  const { jidNormalizedUser } = await import('@whiskeysockets/baileys');
  await entry.sock.sendMessage(jidNormalizedUser(jid), {
    text: `✅ *Vidnov alerts are live*\nYou'll get order and payment alerts here the moment they happen.\n\n— Vidnov Admin`,
  });
  return true;
}
