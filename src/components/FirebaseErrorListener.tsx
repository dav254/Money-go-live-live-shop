'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Listens for globally emitted 'permission-error' events.
 *
 * Previously this component THREW the error into the React tree, which took
 * the whole page down whenever a single Firestore query was denied. Permission
 * denials are data-level problems — the rest of the page still works — so now
 * it renders a dismissible banner instead of crashing, while still surfacing
 * the denied path for debugging.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      setError(error);
      // Keep a console trace for debugging without breaking the UI.
      console.error('[Firestore permission denied]', error.message);
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (!error) return null;

  return (
    <div className="mx-auto my-4 flex max-w-3xl items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-widest text-orange-600">
          Some data could not be loaded
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Firestore denied access to{' '}
          <code className="font-mono">{error.request?.path?.split('/').pop() || 'a collection'}</code>.
          If you should have access, sign in again or contact support.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        aria-label="Dismiss"
        onClick={() => setError(null)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
