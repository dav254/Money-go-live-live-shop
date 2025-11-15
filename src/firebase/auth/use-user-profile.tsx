
'use client';

import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '../provider';
import { useDoc, UseDocResult, WithId } from '../firestore/use-doc';

// Define the shape of the user profile data
export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  joinDate: string;
  userRole: 'buyer' | 'seller' | 'reseller';
}

// Define the return type for the hook
export interface UseUserProfileResult extends UseDocResult<UserProfile> {
  userProfile: WithId<UserProfile> | null;
}

/**
 * A hook to fetch and subscribe to a user's profile from Firestore.
 * @param uid The user's unique ID.
 * @returns An object containing the user profile data, loading state, and error.
 */
export const useUserProfile = (uid: string | undefined): UseUserProfileResult => {
  const firestore = useFirestore();

  // Memoize the document reference to prevent re-renders
  const userProfileRef = useMemoFirebase(() => {
    if (!uid) return null;
    return doc(firestore, 'userProfiles', uid);
  }, [firestore, uid]);

  const { data, isLoading, error } = useDoc<UserProfile>(userProfileRef);

  return {
    data,
    userProfile: data, // Keep `userProfile` for semantic clarity
    isLoading,
    error,
  };
};
