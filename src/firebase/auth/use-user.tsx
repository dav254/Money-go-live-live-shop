
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '../provider';

export interface UserHookResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isLoading, error.
 */
export const useUser = (): UserHookResult => {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserHookResult>({
    user: auth.currentUser, // Initialize with the current user, if any
    isLoading: !auth.currentUser, // If no user, we are likely loading
    error: null,
  });

  useEffect(() => {
    // If there's no auth instance, we can't do anything.
    if (!auth) {
      setUserState({ user: null, isLoading: false, error: new Error("Auth service not available.") });
      return;
    }

    // Set initial loading state
    setUserState({ user: auth.currentUser, isLoading: true, error: null });

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUserState({ user, isLoading: false, error: null });
      },
      (error) => {
        console.error("useUser: onAuthStateChanged error:", error);
        setUserState({ user: null, isLoading: false, error });
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return userState;
};
