import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/account/delete-request — record a deletion request on the account.
 *
 * Google Play requires an app with accounts to offer account deletion. Vidnov
 * has money attached to accounts (orders, payouts, disputes, pending refunds),
 * so an in-app "delete everything now" button would be actively dangerous: a
 * seller could erase the record of an order a buyer is still waiting on, or a
 * refund in flight.
 *
 * So the app records a dated, auditable request on the profile and tells the
 * person exactly what happens next. Support completes the purge on the same
 * schedule the published privacy policy states. Nothing is deleted here, and
 * nothing is claimed to be.
 *
 * The request is idempotent: a second tap refreshes the timestamp only, so a
 * retry on a bad connection cannot create a second ticket.
 */
export async function POST(request: NextRequest) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : '';

  try {
    await db
      .collection('userProfiles')
      .doc(ctx.uid)
      .set(
        {
          deletionRequestedAt: FieldValue.serverTimestamp(),
          deletionRequestReason: reason,
          // Lets support pick the request up in the admin queue without
          // scanning every profile document.
          deletionRequestStatus: 'requested',
        },
        { merge: true },
      );

    return NextResponse.json({
      ok: true,
      message:
        'Your deletion request is recorded. Support will process it within 30 days and email you before the account is removed.',
    });
  } catch {
    console.error('[account/delete-request] write failed');
    return NextResponse.json(
      { error: 'Could not record that request. Email support@vidnov.com and we will handle it.' },
      { status: 500 },
    );
  }
}
