
import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

interface LogErrorOptions {
  userId?: string;
  context?: Record<string, any>;
}

/**
 * Logs an error to the `errorLogs` collection in Firestore.
 * 
 * @param firestore The Firestore instance.
 * @param error The error object to be logged.
 * @param options Additional information, like `userId` and `context`.
 */
export const logError = async (firestore: Firestore, error: Error, options: LogErrorOptions = {}) => {
  try {
    await addDoc(collection(firestore, 'errorLogs'), {
      errorMessage: error.message,
      // Ensure error.stack is not undefined before sending to Firestore
      errorStack: error.stack || null,
      timestamp: serverTimestamp(),
      status: 'new',
      userId: options.userId || null,
      context: options.context || null,
    });
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
    // Fallback to console if Firestore logging fails
    console.error('Original error:', error);
  }
};
