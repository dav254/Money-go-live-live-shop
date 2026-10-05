
'use client';

import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '../provider';
import { useDoc, UseDocResult, WithId } from '../firestore/use-doc';

/**
 * Define the shape of the user profile data.
 *
 * There is a SECOND, wider `UserProfile` in `@/lib/types`. This one is the one
 * `useUserProfile` hands to every consumer, so anything a screen reads off it
 * has to be declared here or the read is a type error — which is how
 * `shop-header` and `buyer-sidebar` ended up unable to read `following` or
 * `profilePictureUrl` even though `lib/types` has declared both for years.
 *
 * Merging the two is the real fix, and it is not a one-line change: this type is
 * narrower in some places and wider in others, and collapsing them silently
 * changes what every caller is allowed to assume. Until that is done
 * deliberately, these fields are declared here and the duplication is the known
 * cost — the alternative is a compile error on data that exists.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  joinDate: string;
  userRole: 'buyer' | 'seller' | 'reseller' | 'admin';
  /**
   * The older field, still present on profiles written before `userRole` existed.
   *
   * `admin-layout` and `admin-sidebar` accept either, because an admin account
   * from before the rename has no `userRole` and would otherwise be locked out
   * of the dashboard that was always theirs. Optional, like every other legacy
   * field here, so the compiler stops calling a real read a missing property.
   */
  role?: 'buyer' | 'seller' | 'reseller' | 'admin';
  /**
   * Account standing, written by moderation. Absent on every profile that has
   * never been suspended, which is why it is optional.
   *
   * Declared here because three call sites already read it — twice in the login
   * flow and once in signup — and the compiler was calling those real reads a
   * missing property. Optional rather than a union of `'active' | 'suspended'`
   * with a default, so no profile has to be rewritten to satisfy the type.
   */
  status?: 'active' | 'suspended';
  wishlist?: string[]; // Array of product IDs
  /** Sellers this user follows. Read by the shop page's follow button. */
  following?: string[];
  profilePictureUrl?: string;
  bio?: string;
  location?: string;
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
