/**
 * Public API + Firebase configuration for the Android app.
 *
 * The Firebase web config is NOT a secret — it is the same public project
 * identifier the website already ships (src/firebase/config.ts). It is
 * embedded here so a fresh clone builds without any local env file. Only the
 * API *base URL* is overridable, for staging.
 */

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 'https://vidnov.com';

export const FIREBASE = {
  apiKey: 'AIzaSyAiVFB7a0FqDu4ivPgL19yQ-aeGnXeRMAo',
  authDomain: 'studio-1725493862-5cb95.firebaseapp.com',
  projectId: 'studio-1725493862-5cb95',
  appId: '1:301611491606:web:d1c3ac4a0468ab032a3037',
} as const;

/** Shown on the settings screen and used for the Play listing. */
export const SUPPORT_EMAIL = 'support@vidnov.com';
export const PRIVACY_URL = 'https://vidnov.com/privacy';
export const TERMS_URL = 'https://vidnov.com/terms';

/**
 * Absolute URL for anything the server hands back.
 *
 * The media pipeline stores RELATIVE paths (`/api/media/file/<path>`, plus
 * thumbnails) because the file is served from whichever host the app is
 * talking to. React Native's image component cannot resolve a relative path —
 * it needs a scheme and a host — so every image reference must pass through
 * here before it reaches the UI. Absolute URLs are left untouched, and local
 * picker URIs (`file:`, `content:`, `ph:`) are passed through so previews work
 * before an upload completes.
 */
export function apiUrl(path?: string | null): string {
  if (!path) return '';
  const value = path.trim();
  if (!value) return '';
  if (/^(https?:|file:|content:|ph:|asset:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${API_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}
