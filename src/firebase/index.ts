'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { SURFACE_APP_NAMES, resolveSurface, type Surface } from '@/lib/auth/surface';
import { installConnectivityLogFilter } from '@/firebase/connectivity-log-filter';

/**
 * Transport settings for every Firestore instance this app creates.
 *
 * `experimentalAutoDetectLongPolling` starts on fetch/XHR streaming and only
 * falls back to long-polling when the backend closes the stream. That is what
 * keeps a laptop on a flaky or proxied network from exhausting the six
 * HTTP/1.1 connection limit and leaving every listener stuck in offline mode.
 *
 * It replaces `experimentalForceLongPolling` (which this file used to set) and
 * must not be combined with it: the SDK throws
 * "experimentalForceLongPolling and experimentalAutoDetectLongPolling cannot be
 * used together" at `initializeFirestore`, which takes down every page rendered
 * in the same process. Auto-detection subsumes force-long-polling, so the
 * forcing flag is simply gone.
 */
const FIRESTORE_SETTINGS = {
  experimentalAutoDetectLongPolling: true,
} as const;

/**
 * IMPORTANT: DO NOT MODIFY THIS FUNCTION
 *
 * The website and the installed app each get their OWN named Firebase app so
 * each surface keeps its own auth session. Firebase derives its persistence key
 * from the app name (`firebase:authUser:<apiKey>:<appName>`), so two named apps
 * mean two independent sessions on the same origin — signing in as admin on the
 * website no longer signs the phone app in, and a seller session in the app
 * never leaks onto the website. See `src/lib/auth/surface.ts`.
 *
 * Both apps point at the same Firebase project: same accounts, same Firestore,
 * same security rules. Only the session is split.
 */
export function initializeFirebase() {
  // Must run before the first Firestore read so a connectivity blip never
  // reaches the Next dev overlay as an unhandled error. See the module doc in
  // `connectivity-log-filter.ts`.
  installConnectivityLogFilter();

  const surface: Surface = resolveSurface();
  const appName = SURFACE_APP_NAMES[surface];

  // `getApps()` may already hold the *other* surface's app, so look ours up by
  // name rather than falling back to `getApp()`.
  const existing = getApps().find((app) => app.name === appName);

  let app: FirebaseApp;
  let firestore: Firestore;

  if (!existing) {
    app = initializeApp(firebaseConfig, appName);
    firestore = initializeFirestore(app, FIRESTORE_SETTINGS);
  } else {
    app = existing;
    // The app already exists, which usually means this surface's Firestore was
    // initialized by an earlier call and the settings above were applied then.
    // `initializeFirestore` throws when it was, so fall back to the cached
    // instance. The try/catch is not merely defensive: without it this branch
    // used `getFirestore` unconditionally, so a surface whose app was created
    // elsewhere silently lost long-polling and came back "offline".
    try {
      firestore = initializeFirestore(app, FIRESTORE_SETTINGS);
    } catch {
      firestore = getFirestore(app);
    }
  }

  return {
    surface,
    firebaseApp: app,
    // The surface's own Auth instance — the whole point of the named app.
    auth: getAuth(app),
    firestore: firestore,
    storage: getStorage(app)
  };
}

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './auth/use-user-profile';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
