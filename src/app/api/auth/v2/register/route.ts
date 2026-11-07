import { NextRequest, NextResponse } from 'next/server';
import { IdentityError, registerAccount } from '@/lib/auth/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/v2/register — create a Vidnov account.
 *
 * The identity is created in PocketBase (see `lib/auth/identity.ts`); the
 * response carries a session for both surfaces: `customToken` for the web
 * Firebase SDK and `idToken`/`refreshToken` for the Android app.
 *
 * Failure rules:
 *   • 409 when the email is taken — checked in PocketBase AND Firebase before
 *     anything is written, so a duplicate can never create a second identity.
 *   • 400 for an unusable email/password, 429 when throttled, 503 when the
 *     identity store is unavailable. The client falls back to Firebase direct
 *     on 503 only, so an outage never blocks signup.
 *   • `role` is clamped server-side to buyer/seller/reseller. Admin cannot be
 *     requested from a public form.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail('invalid_input', 'Send a JSON body.', 400);
  }

  try {
    const session = await registerAccount({
      email: typeof body.email === 'string' ? body.email : '',
      password: typeof body.password === 'string' ? body.password : '',
      fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
      username: typeof body.username === 'string' ? body.username : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      role: typeof body.role === 'string' ? body.role : undefined,
    });

    return NextResponse.json(
      { ok: true, session },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof IdentityError) {
      return fail(error.code, error.message, error.status);
    }
    console.error('[auth/register] unexpected failure:', (error as Error)?.message);
    return fail('identity_unavailable', 'Account creation failed. Try again shortly.', 503);
  }
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
