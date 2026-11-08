import { NextResponse } from 'next/server';
import { AUTH_COLLECTION, checkAuthStore } from '@/lib/pocketbase/auth-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/v2/health — is the account store able to accept logins?
 *
 * Sign-in and sign-up both depend on the PocketBase auth collection. When any
 * step of that is broken (PocketBase down, wrong superuser credentials, the
 * collection missing, password auth off, the `appUid` column gone) the user
 * only sees a generic failure, so this reports WHICH step failed.
 *
 * Deliberately non-mutating and free of credentials, addresses or records:
 * booleans plus HTTP status codes only. Nothing here can be used to enumerate
 * accounts.
 */
export async function GET() {
  const store = await checkAuthStore();
  const ready =
    store.configured &&
    store.authenticated &&
    store.collectionStatus === 200 &&
    store.passwordAuth === 'enabled' &&
    store.appUidField;

  let hint: string | null = null;
  if (!store.configured) {
    hint = 'POCKETBASE_URL / POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD are not set on this server.';
  } else if (!store.authenticated) {
    hint = 'PocketBase is unreachable or the superuser credentials are wrong; check the PocketBase service and those env vars.';
  } else if (store.collectionStatus !== 200) {
    hint = `The "${AUTH_COLLECTION}" auth collection does not exist yet; the next sign-up or login creates it.`;
  } else if (store.passwordAuth !== 'enabled') {
    hint = 'Password auth is disabled on the auth collection, so every login is rejected.';
  } else if (!store.appUidField) {
    hint = 'The auth collection is missing its appUid column, so account creation is rejected.';
  }

  return NextResponse.json(
    { ok: ready, collection: AUTH_COLLECTION, store, hint },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
