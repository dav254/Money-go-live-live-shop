'use client';

/**
 * PWA install prompt capture.
 *
 * `beforeinstallprompt` fires once, and only after Chrome has decided the app
 * is installable — which means after the service worker registers. If the
 * component that wants to show an "Install" button mounts after that event has
 * already fired, a naive `addEventListener` in a `useEffect` misses it entirely
 * and the user silently gets no one-tap install.
 *
 * So the listener is attached here, at module scope, the first time this module
 * is imported — before any component effect runs. The captured event is held
 * and replayed to subscribers, and consumers can also check synchronously on
 * mount.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let captured: BeforeInstallPromptEvent | null = null;
let attached = false;
const listeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function ensureListener() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the browser's own mini-infobar; the app renders its own affordance.
    event.preventDefault();
    captured = event as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(captured));
  });
  window.addEventListener('appinstalled', () => {
    captured = null;
    listeners.forEach((fn) => fn(null));
  });
}

// Attach as soon as the module is evaluated, not on first component mount.
ensureListener();

/** The captured prompt, or null if the browser has not offered one (yet). */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  ensureListener();
  return captured;
}

/** Subscribes to prompt changes. Fires immediately with the current value. */
export function subscribeInstallPrompt(
  fn: (event: BeforeInstallPromptEvent | null) => void
): () => void {
  ensureListener();
  listeners.add(fn);
  fn(captured);
  return () => {
    listeners.delete(fn);
  };
}

/** True when the app is already running as an installed app. */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.matchMedia('(display-mode: fullscreen)').matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Waits for the browser to decide the app is installable.
 *
 * Chrome withholds `beforeinstallprompt` until the service worker has
 * installed, activated and taken control of the page. On a first visit that
 * takes a moment, so a button pressed immediately finds no prompt and appears
 * broken. This waits for the worker to be ready and for the prompt to arrive
 * instead of giving up on the first miss.
 *
 * Resolves null on timeout — including always on iOS, which has no install API
 * at all, so callers should keep the wait bounded.
 */
export function waitForInstallPrompt(timeoutMs = 4000): Promise<BeforeInstallPromptEvent | null> {
  const existing = getInstallPrompt();
  if (existing) return Promise.resolve(existing);
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: BeforeInstallPromptEvent | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    const unsubscribe = subscribeInstallPrompt((event) => {
      if (event) finish(event);
    });

    // Becoming "ready" is the precondition for Chrome offering the prompt —
    // but it is NOT the prompt. On a repeat visit `serviceWorker.ready`
    // resolves immediately (the worker is already active) while
    // `beforeinstallprompt` still arrives a beat later; finishing here with a
    // still-null captured event is exactly what made a one-tap install button
    // silently do nothing. Only finish early when the prompt has actually
    // arrived — otherwise the subscription above settles it as soon as it does.
    navigator.serviceWorker?.ready
      .then(() => {
        const prompt = getInstallPrompt();
        if (prompt) finish(prompt);
      })
      .catch(() => undefined);
  });
}

/**
 * Why a one-tap install cannot work in THIS browsing context — checked
 * before any waiting, so the download section never spins for seconds in a
 * frame where the browser will never offer a prompt.
 *
 *   • EMBEDDED IFRAME — Chrome never fires `beforeinstallprompt` for a
 *     cross-origin frame (a site preview pane is exactly that), so a tap in
 *     there can only dead-end. The honest fix is to leave the frame and try
 *     again in a real tab, which the button does for the user.
 *   • NO SERVICE WORKER / INSECURE — installability requires a secure (https)
 *     origin; on plain http the install API does not exist at all, so the
 *     section must say why instead of pretending.
 *
 * iOS is deliberately NOT a blocker: there is no install API, but Share →
 * Add to Home Screen genuinely installs, so the button offers that route.
 */
export type InstallBlocker = {
  kind: 'iframe' | 'insecure';
  message: string;
};

export function installBlocker(): InstallBlocker | null {
  if (typeof window === 'undefined') return null;
  if (window.self !== window.top) {
    return {
      kind: 'iframe',
      message:
        'This page is showing inside another site, so the browser will not offer an install here. Open Vidnov in a full browser tab — the Install button works there.',
    };
  }
  if (
    typeof navigator === 'undefined' ||
    !window.isSecureContext ||
    !('serviceWorker' in navigator)
  ) {
    return {
      kind: 'insecure',
      message:
        'This address is not a secure (https) connection, so the browser cannot install the app here. Open Vidnov over https and install it from the sidebar button.',
    };
  }
  return null;
}

/**
 * Shows the browser's native install dialog if a prompt is available.
 * Returns the user's choice, or null when no prompt was available.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const event = getInstallPrompt();
  if (!event) return null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') {
    captured = null;
    listeners.forEach((fn) => fn(null));
  }
  return outcome;
}