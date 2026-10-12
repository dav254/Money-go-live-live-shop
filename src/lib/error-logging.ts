import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

interface LogErrorOptions {
  userId?: string;
  context?: Record<string, any>;
}

// Module-level guard to prevent infinite recursion
let isLogging = false;

/**
 * Logs an error to the `errorLogs` collection in Firestore.
 * Highly robust to ensure that logging errors doesn't cause further crashes.
 *
 * @param firestore The Firestore instance.
 * @param error The error object to be logged.
 * @param options Additional information, like `userId` and `context`.
 */
export const logError = async (firestore: Firestore | null, error: Error | null, options: LogErrorOptions = {}): Promise<void> => {
  // Defensive checks to prevent logging loops or crashes
  if (!firestore || !error || isLogging) {
    if (isLogging) {
      // We use a direct console reference here to avoid triggering the global
      // interceptor again.
      if (typeof window !== 'undefined' && (window as any).console?.info) {
        (window as any).console.info('[Error Logging] Suppressing recursive call.');
      }
    }
    return;
  }

  isLogging = true;

  try {
    // Attempt to write the log to Firestore.
    // If the write itself fails for any reason, the catch block keeps this
    // function from throwing and re-triggering the global error boundary.
    await addDoc(collection(firestore, 'errorLogs'), {
      errorMessage: error.message || 'Unknown Error',
      errorStack: error.stack || null,
      timestamp: serverTimestamp(),
      status: 'new',
      userId: options.userId || null,
      context: options.context || null,
      environment: process.env.NODE_ENV || 'development',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    });
  } catch (loggingError) {
    // Ultimate fallback: do not re-throw. This function is called from
    // error-handling code paths, so throwing here would only crash the app
    // again and mask the original cause.
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // Use a direct console reference so we do not depend on any wrapper
      // that might be intercepting console.error.
      const consoleRef = (window as any).console;
      if (consoleRef && typeof consoleRef.warn === 'function') {
        try {
          consoleRef.warn('[Error Logging] Logging failed:', (loggingError as Error).message);
        } catch {
          // If even the direct console.warn throws, drop the log.
        }
      }
    }
  } finally {
    isLogging = false;
  }
};
