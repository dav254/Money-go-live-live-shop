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

    // Becoming "ready" is the precondition for Chrome offering the prompt, so
    // re-check as soon as it happens rather than sitting out the whole timeout.
    navigator.serviceWorker?.ready
      .then(() => finish(getInstallPrompt()))
      .catch(() => undefined);
  });
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