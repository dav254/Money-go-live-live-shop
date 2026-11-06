import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { account, messageFor } from './api';
import {
  AuthError,
  refreshSession,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  type FirebaseSession,
} from './firebase-auth';
import type { Profile } from './types';

/**
 * SESSION.
 *
 * The auth token pair lives in the Android Keystore (expo-secure-store), never
 * in AsyncStorage and never in plain files. On launch the session is restored,
 * refreshed when it is within a minute of expiry, and confirmed against
 * `/api/auth/profile`; a revoked account therefore lands on the sign-in screen
 * instead of a wall of 401s.
 */

const STORAGE_KEY = 'vidnov.session.v1';
const PROFILE_KEY = 'vidnov.profile.v1';
const REFRESH_WINDOW_MS = 60_000;

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  session: FirebaseSession | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; name?: string; role: 'buyer' | 'seller' }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Valid bearer token, refreshed on demand. Throws when signed out. */
  getToken: () => Promise<string>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function readSession(): Promise<FirebaseSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseSession;
    if (!parsed?.idToken || !parsed?.refreshToken || !parsed?.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSession(session: FirebaseSession | null): Promise<void> {
  if (!session) {
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function readCachedProfile(): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

async function writeCachedProfile(profile: Profile | null): Promise<void> {
  if (!profile) {
    await SecureStore.deleteItemAsync(PROFILE_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile)).catch(() => undefined);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<FirebaseSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const sessionRef = useRef<FirebaseSession | null>(null);
  const refreshing = useRef<Promise<FirebaseSession | null> | null>(null);

  const applySession = useCallback(async (next: FirebaseSession | null) => {
    sessionRef.current = next;
    setSession(next);
    await writeSession(next);
  }, []);

  const loadProfile = useCallback(async (token: string): Promise<Profile | null> => {
    try {
      const { profile: fresh } = await account.profile(token);
      if (fresh && typeof fresh === 'object') {
        setProfile(fresh as Profile);
        await writeCachedProfile(fresh as Profile);
        return fresh as Profile;
      }
      return null;
    } catch {
      // Offline or a transient server error must not sign a person out; the
      // cached profile keeps the app usable until the next successful call.
      return null;
    }
  }, []);

  const ensureToken = useCallback(async (): Promise<string> => {
    const current = sessionRef.current;
    if (!current) throw new AuthError('Sign in to continue.', 'signed_out');

    if (current.expiresAt - REFRESH_WINDOW_MS > Date.now()) return current.idToken;

    if (!refreshing.current) {
      refreshing.current = (async () => {
        try {
          const refreshed = await refreshSession(current.refreshToken);
          const merged: FirebaseSession = {
            ...refreshed,
            email: current.email || refreshed.email,
          };
          await applySession(merged);
          return merged;
        } catch {
          await applySession(null);
          setProfile(null);
          await writeCachedProfile(null);
          setStatus('signedOut');
          return null;
        } finally {
          refreshing.current = null;
        }
      })();
    }

    const refreshed = await refreshing.current;
    if (!refreshed) throw new AuthError('Your session has expired. Sign in again.', 'session_expired');
    return refreshed.idToken;
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    try {
      const token = await ensureToken();
      await loadProfile(token);
    } catch {
      // Signed out — nothing to refresh.
    }
  }, [ensureToken, loadProfile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readSession();
      if (cancelled) return;

      if (!stored) {
        setStatus('signedOut');
        return;
      }

      sessionRef.current = stored;
      setSession(stored);
      setProfile(await readCachedProfile());
      setStatus('signedIn');

      // Confirm in the background: keeps a signed-in person on screen while
      // restoring, but signs out a revoked/expired session.
      try {
        const token = await ensureToken();
        await loadProfile(token);
      } catch {
        if (!cancelled) {
          await applySession(null);
          setProfile(null);
          setStatus('signedOut');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await signInWithPassword(email, password);
      await applySession(next);
      setStatus('signedIn');
      await loadProfile(next.idToken);
    },
    [applySession, loadProfile],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; name?: string; role: 'buyer' | 'seller' }) => {
      const next = await signUpWithPassword(input.email, input.password);
      await applySession(next);
      setStatus('signedIn');

      // Every Vidnov account needs a profile document; the server owns that
      // write (it also mirrors it to the VPS store) so a failed client write
      // can never leave a half-created account.
      try {
        const { profile: created } = await account.ensureProfile(next.idToken, {
          role: input.role,
          name: input.name,
        });
        if (created) {
          setProfile(created as Profile);
          await writeCachedProfile(created as Profile);
        }
      } catch (error) {
        // Signed in but profile repair failed: surface it, do not fake success.
        throw new Error(
          `Your account was created, but your profile could not be finished. ${messageFor(error)}`,
        );
      }
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await applySession(null);
    setProfile(null);
    await writeCachedProfile(null);
    setStatus('signedOut');
  }, [applySession]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      profile,
      signIn,
      signUp,
      signOut,
      resetPassword: sendPasswordReset,
      getToken: ensureToken,
      refreshProfile,
    }),
    [status, session, profile, signIn, signUp, signOut, ensureToken, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
