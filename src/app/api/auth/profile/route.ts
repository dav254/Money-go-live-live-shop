import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/server';
import { ensureUserProfile, readUserProfile } from '@/lib/auth/profile-ensure';

export const runtime = 'nodejs';

/**
 * GET /api/auth/profile — the signed-in user's profile, read server-side.
 *
 * Firestore first, the local VPS (PocketBase) store second. Used by the
 * surface boundary as a fallback when the CLIENT-side Firestore read fails,
 * so "We couldn't load your account" resolves instead of dead-ending a
 * perfectly good account.
 */
export async function GET(request: NextRequest) {
  const uid = await uidFromRequest(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await readUserProfile(uid);
  return NextResponse.json({ ok: true, profile });
}

/**
 * POST /api/auth/profile { role } — repair a signed-in account whose profile
 * is missing everywhere (the signup write failed). Creates the profile
 * server-side in both stores from what Auth already knows, then the client
 * reloads into the right section.
 */
export async function POST(request: NextRequest) {
  const uid = await uidFromRequest(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { role?: string; name?: string };
  const role = (body.role ?? '').toString();
  if (!['buyer', 'seller', 'reseller'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Never clobber an account that already has a profile.
  const existing = await readUserProfile(uid);
  if (existing?.userRole) {
    return NextResponse.json({ ok: true, profile: existing, healed: false });
  }

  // What Auth knows about this person — no Firestore involved.
  let decoded: { email?: string | null; name?: string | null } = {};
  try {
    const bearer = bearerToken(request);
    if (bearer) decoded = await auth.verifyIdToken(bearer);
  } catch {
    // uid already verified above; claims are best-effort enrichment.
  }

  const profile = await ensureUserProfile({
    uid,
    role,
    name: body.name || decoded.name || undefined,
    email: decoded.email || undefined,
  });
  return NextResponse.json({ ok: true, profile, healed: true });
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function uidFromRequest(request: NextRequest): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const { uid } = await auth.verifyIdToken(token);
    return uid;
  } catch {
    return null;
  }
}
