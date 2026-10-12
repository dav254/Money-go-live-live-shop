'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';

export const GlobalErrorListener = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const isInitialized = useRef(false);

  useEffect(() => {
    // Small delay to ensure services are fully up before capturing initial load errors
    const initTimer = setTimeout(() => {
      isInitialized.current = true;
    }, 1000);

    const handleGlobalError = (event: ErrorEvent) => {
      if (!isInitialized.current) return;
      // Swallow logging errors here too: this handler runs on
      // window.onerror, so throwing would surf the app back into the
      // error path that triggered it.
      try {
        const enqueue = typeof window !== 'undefined'
          ? (window as any).__deferredErrorLoggerEnqueue
          : undefined;
        if (enqueue) {
          enqueue(event.error, {
            userId: user?.uid,
            context: {
              type: 'global',
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
            },
          });
        }
      } catch {
        // Keep the listener alive.
      }
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      if (!isInitialized.current) return;
      let error: Error;
      if (event.reason instanceof Error) {
        error = event.reason;
      } else if (event.reason instanceof Promise) {
        // Unhandled promise rejections of pending promises are not yet
        // useful as log payloads; skip logging this one.
        return;
      } else {
        error = new Error(String(event.reason));
      }
      try {
        const enqueue = typeof window !== 'undefined'
          ? (window as any).__deferredErrorLoggerEnqueue
          : undefined;
        if (enqueue) {
          enqueue(error, {
            userId: user?.uid,
            context: {
              type: 'unhandled-promise-rejection',
            },
          });
        }
      } catch {
        // Keep the listener alive.
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [user, firestore]);

  return null;
};
