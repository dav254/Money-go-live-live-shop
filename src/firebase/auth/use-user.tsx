
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If there's no auth instance, we can't do anything.
    if (!auth) {
      setUser(null);
      setIsLoading(false);
      setError(new Error("Auth service not available."));
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setIsLoading(false);
        setError(null);
      },
      (error) => {
        console.error("useUser: onAuthStateChanged error:", error);
        setUser(null);
        setIsLoading(false);
        setError(error);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return { user, isLoading, error };
};
