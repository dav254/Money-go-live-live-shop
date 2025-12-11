'use client';

import { useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase'; 
import { logError } from '@/lib/error-logging';

export const GlobalErrorListener = () => {
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
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
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [user, firestore]);

  return null;
};
