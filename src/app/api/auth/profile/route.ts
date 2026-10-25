import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/server';
import { ensureUserProfile, readUserProfile } from '@/lib/auth/profile-ensure';

export const runtime = 'nodejs';

/**
 * Credential-shaped fields that must NEVER round-trip to a browser — legacy
 * TikTok tokens were historically stored on userProfiles documents under
 * `connections`, and profile reads are the classic place for such a document
 * to leak wholesale into a JSON response. Applied to EVERY profile this
 * route returns, so a legacy token field can never ride along.
 */
const SENSITIVE_FIELD =
  /^(connections|tiktok[A-Za-z]*|.*access[Tt]oken|.*refresh[Tt]oken|.*client[Ss]ecret|.*api[Kk]ey|.*credential.*|customClaims)$/;

function publicProfile<T>(profile: T | null | undefined): T | null {
  if (!profile || typeof profile !== 'object') return profile ?? null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
    if (SENSITIVE_FIELD.test(key)) continue;
    out[key] = value;
  }
  return out as T;
}

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
  return NextResponse.json({ ok: true, profile: publicProfile(profile) });
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
    return NextResponse.json({ ok: true, profile: publicProfile(existing), healed: false });
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
  return NextResponse.json({ ok: true, profile: publicProfile(profile), healed: true });
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
