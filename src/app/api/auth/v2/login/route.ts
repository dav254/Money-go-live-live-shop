import { NextRequest, NextResponse } from 'next/server';
import { IdentityError, signInAccount } from '@/lib/auth/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/v2/login — sign in with email + password.
 *
 * PocketBase verifies the credential. An email PocketBase has never seen is a
 * pre-migration account: its password is checked against Firebase once, and on
 * success the account is moved into PocketBase under its EXISTING uid (see
 * `lib/auth/identity.ts`), so the user keeps their id, data and orders.
 *
 * Failures are deliberately uniform: a wrong password, an unknown email and a
 * never-migrated account all return the same 401 body, so the endpoint cannot
 * be used to discover which emails have Vidnov accounts.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail('invalid_credentials', 'The email or password is not correct.', 401);
  }

  try {
    const session = await signInAccount({
      email: typeof body.email === 'string' ? body.email : '',
      password: typeof body.password === 'string' ? body.password : '',
    });
    return NextResponse.json(
      { ok: true, session },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof IdentityError) {
      return fail(error.code, error.message, error.status);
    }
    console.error('[auth/login] unexpected failure:', (error as Error)?.message);
    return fail('identity_unavailable', 'Sign-in failed. Try again shortly.', 503);
  }
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
