'use client';

import { getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { SURFACE_APP_NAMES, resolveSurface } from '@/lib/auth/surface';

/**
 * Surface-aware replacement for the no-argument `getAuth()`.
 *
 * `getAuth()` always resolves against the `[DEFAULT]` app, so inside the
 * installed app it would hand back the *website's* session — the exact leak
 * this project is closing. Anything that needs the Auth instance outside a
 * React component (error reporting helpers, imperative handlers) must use this
 * instead.
 *
 * Inside a component prefer `useAuth()` from `@/firebase`.
 */
export function getSurfaceAuth(): Auth {
  return getAuth(getSurfaceApp());
}

/**
 * The FirebaseApp for THIS surface.
 *
 * Every `getX()` helper that takes an optional app — `getMessaging`,
 * `getFirestore`, `getStorage` — defaults to `[DEFAULT]`, which is the
 * *website's* app. Inside the installed app that either throws
 * ("No Firebase App '[DEFAULT]' has been created") for a visitor who never
 * opened the website in that tab, or silently hands back the website's
 * services when they did. The second case is the dangerous one: Cloud Messaging
 * scoped to the wrong app would mint a token under the website's session.
 *
 * This is the same defect `useStorage()` documents for uploads, and the same
 * fix: always pass the surface's own app.
 */
export function getSurfaceApp(): FirebaseApp {
  const appName = SURFACE_APP_NAMES[resolveSurface()];
  return getApps().find((candidate) => candidate.name === appName) ?? getApp();
}
