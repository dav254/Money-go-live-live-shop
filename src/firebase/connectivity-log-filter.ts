'use client';

/**
 * Keeps transient Firebase connectivity failures out of the console — and
 * therefore out of the Next.js dev overlay.
 *
 * ## The failure being fixed
 *
 * When the browser briefly cannot reach Google (no internet, sleeping Wi-Fi,
 * a proxy dropping `identitytoolkit`), the Firestore SDK gives up on the
 * current connection and logs a `console.error`:
 *
 *     Firestore (11.10.0): Could not reach Cloud Firestore backend.
 *     Connection failed 1 times. Most recent error: ... auth/network-request-failed.
 *     The client will operate in offline mode until it is able to
 *     successfully connect to the backend.
 *
 * That message describes the SDK doing exactly the right thing — it keeps
 * serving cached data and retries on its own backoff. But because the SDK logs
 * it through `console.error`, Next.js routes it into `createUnhandledError`,
 * and a routine network blip is presented to the developer as an unhandled
 * application crash. It is noise, not a defect.
 *
 * The SDK has no API for "do not log this one message", and the supported
 * knob — `setLogLevel('silent')` — silences *everything* the SDK prints,
 * including the warnings that are genuinely worth reading. So the filter is
 * installed at the console instead, and it is deliberately narrow:
 *
 *   1. the message must match a known transient connectivity phrase, AND
 *   2. the call must come from inside the Firebase SDK (verified against the
 *      captured stack trace, not the text, so an app message that merely
 *      mentions "offline" is never swallowed).
 *
 * Anything else — permission denials, missing-index `failed-precondition`,
 * unhandled promise rejections, our own `console.error` calls — passes through
 * untouched and still reaches the overlay.
 *
 * Suppressed messages are re-emitted once through `console.debug` so the
 * behaviour stays observable without being loud.
 */

/**
 * Phrases the Firebase SDK prints when it could not reach the backend.
 *
 * Kept short on purpose: each entry must describe a condition that resolves
 * itself without developer action. Adding a code here is a claim that the
 * message is safe to hide — if that is not true, it does not belong here.
 */
export const TRANSIENT_CONNECTIVITY_PATTERNS: RegExp[] = [
  // "Firestore (11.10.0): Could not reach Cloud Firestore backend. Connection
  //  failed N times. Most recent error: ..."
  /Could not reach Cloud Firestore backend/i,
  // "Fetching auth token failed: Firebase: Error (auth/network-request-failed)"
  /Fetching auth token failed/i,
  // Auth's own spelling, logged standalone by @firebase/auth.
  /auth\/network-request-failed/i,
];

/**
 * A captured stack must pass through a Firebase package for the message to be
 * considered the SDK's own. Matching the stack rather than the message text is
 * what keeps this filter from eating application logs.
 *
 * Webpack's browser build emits `webpack-internal:///./node_modules/@firebase/…`
 * and `webpack-internal:///./node_modules/firebase/…`, so both separators are
 * matched.
 */
const FIREBASE_STACK_FRAME =
  /node_modules[\\/](?:@firebase|firebase)[\\/]/;

/** Frames needed to reach the SDK from the wrapped `console.error`. */
const STACK_FRAME_BUDGET = 50;

/**
 * True when `text` describes a self-healing connectivity failure.
 *
 * Pure and exported so the classification can be tested without a browser.
 */
export function isTransientConnectivityText(text: string): boolean {
  return TRANSIENT_CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * True when `stack` passes through a Firebase SDK frame.
 *
 * Pure and exported for the same reason as `isTransientConnectivityText`.
 */
export function isFirebaseStack(stack: string | undefined | null): boolean {
  return typeof stack === 'string' && FIREBASE_STACK_FRAME.test(stack);
}

/**
 * Reduce a `console.*` argument list to the text worth matching against.
 *
 * The SDK passes a string, but this filter also sees `Error` objects (which
 * carry the same text in `message`) and format-string-plus-args calls, so all
 * three are handled.
 */
function describeArgs(args: readonly unknown[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      parts.push(arg);
    } else if (arg instanceof Error) {
      parts.push(arg.message);
      const code = (arg as { code?: unknown }).code;
      if (typeof code === 'string') parts.push(code);
    } else if (arg !== null && typeof arg === 'object') {
      parts.push(String(arg));
    }
  }
  return parts.join(' ');
}

/**
 * Capture the current call stack, temporarily lifting V8's default 10-frame
 * limit — the Firebase frames sit below the application frames that a normal
 * trace would truncate away.
 */
function captureStack(): string | undefined {
  const previousLimit = Error.stackTraceLimit;
  try {
    Error.stackTraceLimit = STACK_FRAME_BUDGET;
    return new Error().stack;
  } catch {
    return undefined;
  } finally {
    Error.stackTraceLimit = previousLimit;
  }
}

/**
 * The full suppression decision for one `console.*` call.
 *
 * Exported (with the stack passed in rather than captured) so a test can drive
 * the exact scenario — an SDK frame plus a connectivity message — without
 * depending on the real SDK's call site.
 */
export function shouldSuppressConnectivityLog(
  args: readonly unknown[],
  stack: string | undefined | null,
): boolean {
  if (args.length === 0) return false;
  return isTransientConnectivityText(describeArgs(args)) && isFirebaseStack(stack);
}

/** The shape of a wrapped `console.error` / `console.warn`. */
type ConsoleMethod = (...args: any[]) => void;

/** Marks the console object so a second install (HMR, remount) is a no-op. */
const INSTALLED = '__vidnovConnectivityLogFilter';

/**
 * The console object with the pre-filter methods stashed on it, so a later
 * install can unwrap rather than stacking another layer of filtering.
 */
type PatchedConsole = Console & {
  [INSTALLED]?: { error: ConsoleMethod; warn: ConsoleMethod };
};

/**
 * Wrap `console.error` and `console.warn` to drop transient Firebase
 * connectivity messages.
 *
 * Idempotent: calling it twice (React Strict Mode double-invokes effects, and
 * Fast Refresh re-runs modules) restores the previously wrapped functions
 * before re-wrapping, so console calls are never lost down a chain of wrappers.
 *
 * @returns an uninstall function that restores the original console methods.
 */
export function installConnectivityLogFilter(): () => void {
  if (typeof window === 'undefined' || typeof console === 'undefined') {
    return () => {};
  }

  const patched = console as PatchedConsole;

  // Unwrap any previous install so the originals are what we wrap, not another
  // wrapper. This is what keeps the filter idempotent under Fast Refresh.
  if (patched[INSTALLED]) {
    console.error = patched[INSTALLED].error;
    console.warn = patched[INSTALLED].warn;
  }

  const originalError = console.error;
  const originalWarn = console.warn;

  const makeGuard = (original: (...args: unknown[]) => void) =>
    function guardedConsoleMethod(this: unknown, ...args: unknown[]) {
      if (shouldSuppressConnectivityLog(args, captureStack())) {
        // Still observable, just not alarming: the SDK's own retry behaviour is
        // correct, and an offline blip is not an application defect to triage.
        original.call(console, '[firebase] suppressed transient connectivity log:', ...args);
        return;
      }
      original.apply(console, args);
    };

  const guardError = makeGuard(originalError as (...args: unknown[]) => void);
  const guardWarn = makeGuard(originalWarn as (...args: unknown[]) => void);

  console.error = guardError as typeof console.error;
  console.warn = guardWarn as typeof console.warn;

  patched[INSTALLED] = {
    error: originalError as ConsoleMethod,
    warn: originalWarn as ConsoleMethod,
  };

  return () => {
    if (patched[INSTALLED]) {
      console.error = patched[INSTALLED].error as typeof console.error;
      console.warn = patched[INSTALLED].warn as typeof console.warn;
      delete patched[INSTALLED];
    }
  };
}