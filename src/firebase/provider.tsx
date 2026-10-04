
'use client';

import React, {
  DependencyList,
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Auth, User } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import type { Surface } from '@/lib/auth/surface';

// This is the new type that will be stored in the context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  /**
   * Which UI this document load belongs to, or null until the client has
   * mounted.
   *
   * null is load-bearing: the surface is derived from `sessionStorage`, which
   * does not exist during SSR. Resolving it eagerly made the server render the
   * website while the client rendered the app chrome, which React reports as a
   * hydration mismatch and then re-renders the whole tree. Consumers must treat
   * null as "not known yet" and render their neutral first paint.
   */
  surface: Surface | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(
  undefined
);

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  surface: Surface;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  surface,
}) => {
  // Start null so the first client render matches the server's. The real
  // surface is read after mount, which is the earliest point sessionStorage is
  // available.
  const [resolvedSurface, setResolvedSurface] = useState<Surface | null>(null);

  useEffect(() => {
    setResolvedSurface(surface);
  }, [surface]);

  const contextValue = useMemo(
    (): FirebaseContextState => ({
      firebaseApp,
      firestore,
      auth,
      surface: resolvedSurface,
    }),
    [firebaseApp, firestore, auth, resolvedSurface]
  );

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

// Hook to access the core services
const useFirebaseServices = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseServices must be used within a FirebaseProvider.');
  }
  return context;
};

export const useAuth = (): Auth => {
  const { auth } = useFirebaseServices();
  if (!auth) {
    throw new Error('Firebase Auth service is not available.');
  }
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebaseServices();
  if (!firestore) {
    throw new Error('Firebase Firestore service is not available.');
  }
  return firestore;
};

/**
 * The surface this document load belongs to, or null before mount.
 *
 * Each surface runs its own Firebase app and therefore its own independent
 * auth session. Callers MUST handle null: render the same thing the server
 * rendered rather than guessing, or hydration will mismatch.
 */
export const useSurface = (): Surface | null => useFirebaseServices().surface;

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebaseServices();
  if (!firebaseApp) {
    throw new Error('Firebase App instance is not available.');
  }
  return firebaseApp;
};

/**
 * Firebase Storage for THIS surface.
 *
 * ## Why this hook exists
 *
 * Each surface runs its own *named* Firebase app (`vidnov-web` / `vidnov-app`)
 * so the two keep independent auth sessions — see `initializeFirebase()`.
 * Calling `getStorage()` with no argument asks Firebase for the `[DEFAULT]`
 * app, and this project never creates one. The result is a hard crash the
 * moment the user touches the feature:
 *
 *     FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created
 *       - call initializeApp() first (app/no-app).
 *
 * That is not a theoretical edge case — it is what a seller pressing record on
 * a voice note hit, and the same latent crash sits in every screen that
 * uploads an image.
 *
 * The fix is to always pass the surface's app explicitly. `getStorage` caches
 * per app instance, so calling this on each render is cheap and always returns
 * the same bucket-bound instance for the current surface.
 */
export const useStorage = (): FirebaseStorage => {
  const app = useFirebaseApp();
  return useMemo(() => getStorage(app), [app]);
};


type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
