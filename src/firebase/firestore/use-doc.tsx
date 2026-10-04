'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { classifyFirestoreError, FirestorePermissionError } from '@/firebase/errors';

/**
 * Utility type to add an 'id' field to a given type T.
 *
 * Re-exported rather than redeclared: `firebase/index.ts` re-exports both this
 * module and `use-collection`, so a second local definition makes the barrel's
 * `export *` ambiguous. `use-user-profile` imports `WithId` from HERE, so it
 * must still leave this module.
 */
import type { WithId } from './use-collection';
export type { WithId };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  // The ref this data belongs to once a snapshot (or an error) has landed for
  // it. `undefined` means "nothing has settled yet".
  const [settledRef, setSettledRef] = useState<
    DocumentReference<DocumentData> | null | undefined
  >(undefined);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setSettledRef(undefined);
      return;
    }

    setError(null);

    let cancelled = false;

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (cancelled) return;
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          // Document does not exist
          setData(null);
        }
        setError(null); // Clear any previous error on successful snapshot (even if doc doesn't exist)
        setSettledRef(memoizedDocRef);
      },
      (error: FirestoreError) => {
        if (cancelled) return;
        // A failed fetch is only a rules denial when the request actually reached
        // Firestore. This used to build a `FirestorePermissionError` for every
        // error AND emit the global banner unconditionally, so losing
        // connection briefly stamped "Firestore denied access to X" across the
        // whole app. See `classifyFirestoreError`.
        const { error: contextualError, isDenied } = classifyFirestoreError(error, {
          operation: 'get',
          path: memoizedDocRef.path,
        })

        setError(contextualError)
        setData(null)
        setSettledRef(memoizedDocRef)

        // Only genuine rule failures propagate globally.
        if (isDenied) {
          errorEmitter.emit('permission-error', contextualError as FirestorePermissionError)
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [memoizedDocRef]); // Re-run if the memoizedDocRef changes.

  // WHY THIS IS DERIVED INSTEAD OF STORED
  //
  // `isLoading` used to be its own state, initialised to `false`. That made a
  // document which had not been read yet indistinguishable from a document
  // that is genuinely empty — most painfully on the single render right after
  // sign-in, where `user` arrives one render before the profile ref does.
  // Every role gate reads "loaded, no profile" as "no role", and the surface
  // boundary answered that by signing the user straight back out. Deriving the
  // flag from the ref removes the window entirely: a ref that exists and has not
  // reported yet is always loading, whatever the previous ref was doing.
  const isLoading = memoizedDocRef != null && settledRef !== memoizedDocRef;

  return { data, isLoading, error };
}