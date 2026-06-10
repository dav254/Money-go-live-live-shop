'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase'; 
import { logError } from '@/lib/error-logging';

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
      logError(firestore, event.error, { 
        userId: user?.uid, 
        context: { 
          type: 'global',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      if (!isInitialized.current) return;
      let error;
      if (event.reason instanceof Error) {
        error = event.reason;
      } else {
        error = new Error(String(event.reason));
      }
      logError(firestore, error, { 
        userId: user?.uid, 
        context: { 
          type: 'unhandled-promise-rejection'
        }
      });
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