/**
 * Shared plumbing for the /api/mobile/admin/* routes.
 *
 * Authorisation is always `verifyAdminUid` — the same server-side check the
 * web console uses (Firebase ID token + env allowlist + PocketBase + Firestore
 * role). A `userRole` sent by the app is never considered: the Android client
 * cannot grant itself access.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';

export type AdminGate = { uid: string; response: null } | { uid: null; response: NextResponse };

export async function adminGate(request: NextRequest): Promise<AdminGate> {
  const uid = await verifyAdminUid(request);
  if (!uid) {
    return {
      uid: null,
      response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
    };
  }
  return { uid, response: null };
}

export function isStoreError(error: unknown): boolean {
  return (
    (error as { code?: string })?.code === 'pocketbase_unavailable' ||
    /PocketBase is not configured/i.test(String((error as Error)?.message ?? ''))
  );
}

export async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const noStore = { 'Cache-Control': 'no-store' } as const;

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: noStore });
}
