import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import {
  connectWhatsAppFor,
  disconnectWhatsAppFor,
  sendTestAlertTo,
  whatsappStatusFor,
} from '@/lib/whatsapp/bridge';

/**
 * GET  → current pairing status for THIS admin (state + QR while pairing).
 * POST → { action: 'connect' | 'disconnect' | 'test' }.
 *
 * Admin-only. The bridge itself lives in `lib/whatsapp/bridge.ts` and holds
 * one WhatsApp Web session per admin uid on the server's disk.
 */

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const { uid } = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const profile = await db.collection('userProfiles').doc(uid).get();
    if (profile.data()?.userRole !== 'admin') return null;
    return uid;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const uid = await requireAdmin(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(whatsappStatusFor(uid));
}

export async function POST(request: NextRequest) {
  const uid = await requireAdmin(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = (await request.json().catch(() => ({}))) as { action?: string };

  try {
    switch (action) {
      case 'connect':
        return NextResponse.json(await connectWhatsAppFor(uid));
      case 'disconnect':
        return NextResponse.json(await disconnectWhatsAppFor(uid));
      case 'test':
        await sendTestAlertTo(uid);
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
