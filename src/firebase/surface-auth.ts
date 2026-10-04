'use client';

import { getApps, getApp } from 'firebase/app';
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
  const appName = SURFACE_APP_NAMES[resolveSurface()];
  const app = getApps().find((candidate) => candidate.name === appName) ?? getApp();
  return getAuth(app);
}
