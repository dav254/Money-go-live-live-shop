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
export const logError = async (firestore: Firestore | null, error: Error | null, options: LogErrorOptions = {}) => {
  // Defensive checks to prevent logging loops or crashes
  if (!firestore || !error || isLogging) {
    if (isLogging) {
        // We use a raw console method here to avoid triggering the global interceptor again
        process.env.NODE_ENV === 'development' && window.console.info('[Error Logging] Suppressing recursive call.');
    }
    return;
  }

  isLogging = true;

  try {
    // Attempt to write the log to Firestore. 
    // This is allowed for guests via firestore.rules
    await addDoc(collection(firestore, 'errorLogs'), {
      errorMessage: error.message || 'Unknown Error',
      errorStack: error.stack || null,
      timestamp: serverTimestamp(),
      status: 'new',
      userId: options.userId || null,
      context: options.context || null,
      environment: process.env.NODE_ENV,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    });
  } catch (loggingError) {
    // Ultimate fallback: don't use console.error here as it might be intercepted
    process.env.NODE_ENV === 'development' && window.console.warn('Logging failed:', (loggingError as Error).message);
  } finally {
    isLogging = false;
  }
};
