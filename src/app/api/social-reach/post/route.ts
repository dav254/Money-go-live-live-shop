import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { getFreshTikTokAccessToken, getTikTokConnection } from '@/lib/tiktok/store';
import { postVideoToTikTok, getTikTokPublishStatus } from '@/lib/tiktok';
import {
  publishingGate,
  socialReachPostCost,
  MAX_CAPTION_LENGTH,
  REQUIRED_TIKTOK_SCOPES,
} from '@/lib/social-reach/config';
import { createJobAndCharge, transitionJob, jobDocId, type JobStatus } from '@/lib/social-reach/jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/social-reach/post — publish one seller product video to TikTok.
 *
 * Safety design:
 *   1. Server-side authorization: uid from the verified token. Product must
 *      belong to THAT seller — an arbitrary sellerId in the body means nothing.
 *   2. Feature gate: runs only when both server flags say TikTok granted
 *      public direct-post approval (see config.ts). Otherwise 503 — this
 *      endpoint cannot be talked into bypassing TikTok's approval process.
 *   3. Money: one transaction charges points and creates the job document
 *      (the idempotency record), so double-submits cannot double-charge.
 *   4. Settlement: PUBLISHED is only set after TikTok's status endpoint says
 *      PUBLISH_COMPLETE. Definitive failures refund exactly once, inside a
 *      guarded transition. Uncertain results park as UNKNOWN — no blind
 *      retry, no refund, reconcile first.
 */

interface PostBody {
  productId?: string;
  caption?: string;
  hashtags?: string;
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only business accounts can publish.' }, { status: 403 });
  }

  const gate = publishingGate();
  if (!gate.enabled) {
    return NextResponse.json({ error: 'publishing_disabled', message: gate.reason }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const productId = (body.productId ?? '').toString().trim();
  const captionRaw = (body.caption ?? '').toString();
  const hashtags = (body.hashtags ?? '').toString().trim();
  const idempotencyKey = (body.idempotencyKey ?? '').toString().trim();
  const caption = [captionRaw.trim(), hashtags.replace(/\s+/g, ' ')].filter(Boolean).join(' ').trim();

  if (!productId) return NextResponse.json({ error: 'Select a product or video first.' }, { status: 400 });
  if (!caption) return NextResponse.json({ error: 'Add a caption.' }, { status: 400 });
  if (caption.length > MAX_CAPTION_LENGTH) {
    return NextResponse.json({ error: `Caption is too long (max ${MAX_CAPTION_LENGTH} characters).` }, { status: 400 });
  }
  try {
    jobDocId(user.uid, idempotencyKey); // validates format, throws on junk
  } catch {
    return NextResponse.json({ error: 'Invalid idempotency key.' }, { status: 400 });
  }

  // --- Ownership: the product must belong to the verified caller. ---
  const productSnap = await db.collection('products').doc(productId).get().catch(() => null);
  if (!productSnap?.exists) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const product = productSnap.data() as { sellerId?: string; name?: string; videoUrl?: string; videoUrls?: string[] };
  if (product.sellerId !== user.uid) {
    return NextResponse.json({ error: 'You can only publish your own products.' }, { status: 403 });
  }

  // --- Media: server-side transfer needs any URL our server can fetch. ---
  const videoUrl = product.videoUrl || (product.videoUrls ?? []).find((u) => typeof u === 'string' && u.length > 0);
  if (!videoUrl) {
    return NextResponse.json(
      { error: 'This listing has no video yet. TikTok posts need a video — add one to the listing first.' },
      { status: 400 },
    );
  }

  // --- Connection + scopes ---
  const conn = await getTikTokConnection(user.uid);
  if (!conn?.accessToken || conn.needsReconnect) {
    return NextResponse.json({ error: 'not_connected', message: 'Connect your TikTok account first.' }, { status: 409 });
  }
  const scopes = Array.isArray(conn.scopes) ? conn.scopes : [];
  if (!REQUIRED_TIKTOK_SCOPES.every((s) => scopes.includes(s))) {
    return NextResponse.json(
      { error: 'missing_scope', message: 'Your TikTok connection is missing the video.publish permission. Reconnect TikTok.' },
      { status: 403 },
    );
  }

  const cost = socialReachPostCost();

  // --- Charge + job creation, atomically, idempotently. ---
  const created = await createJobAndCharge({
    sellerId: user.uid,
    idempotencyKey,
    cost,
    productId,
    productName: product.name || 'Untitled listing',
    caption,
  });

  if ('insufficientPoints' in created) {
    return NextResponse.json(
      { error: 'insufficient_points', message: `This post costs ${cost} points. Your balance: ${created.balance}.` },
      { status: 402 },
    );
  }

  const jobId = created.job.id;
  if ('duplicate' in created.job && created.job.duplicate) {
    // Second click / retry — no new charge; report the existing outcome.
    return NextResponse.json(
      { jobId, status: created.job.status, duplicate: true, message: 'This post was already submitted.' },
      { status: 200 },
    );
  }

  // Mark SUBMITTING so a crashed submit can be told apart from a no-op.
  await transitionJob({ jobId, to: 'SUBMITTING' as JobStatus });

  // --- Fresh access token (refreshes near-expiry tokens server-side). ---
  const accessToken = await getFreshTikTokAccessToken(user.uid);
  if (!accessToken) {
    const rolled = await transitionJob({ jobId, to: 'FAILED' as JobStatus, errorMessage: 'TikTok connection expired.' });
    if (!rolled.refunded) await transitionJob({ jobId, to: 'REFUNDED' as JobStatus });
    return NextResponse.json(
      { error: 'not_connected', message: 'Your TikTok connection expired. Reconnect and try again — you were not charged.' },
      { status: 409 },
    );
  }

  // --- Submit to TikTok's Content Posting API. ---
  let submit: { success: boolean; publishId?: string; message: string };
  try {
    submit = await postVideoToTikTok({ title: caption, videoUrl, accessToken });
  } catch (error) {
    // Network exception with unknown outcome → uncertain, park it.
    await transitionJob({ jobId, to: 'UNKNOWN' as JobStatus, errorMessage: 'Submit outcome unknown.' });
    console.error('[social-reach] submit threw', (error as Error)?.message);
    return NextResponse.json(
      {
        jobId,
        status: 'UNKNOWN',
        message: 'We could not confirm TikTok received your post. It will be reconciled before any charge settles — you were not charged twice.',
      },
      { status: 202 },
    );
  }

  if (!submit.success || !submit.publishId) {
    // Definitive API rejection → refund exactly once.
    const failed = await transitionJob({ jobId, to: 'FAILED' as JobStatus, errorMessage: submit.message });
    if (failed.status !== 'REFUNDED') await transitionJob({ jobId, to: 'REFUNDED' as JobStatus });
    return NextResponse.json({ jobId, status: 'FAILED', message: `TikTok rejected the post: ${submit.message}` }, { status: 502 });
  }

  // --- Accepted ≠ published: ask TikTok how it actually ended. ---
  let status = 'UNKNOWN';
  try {
    const poll = await getTikTokPublishStatus(accessToken, submit.publishId);
    status = poll.status;
  } catch {
    status = 'UNKNOWN';
  }

  if (status === 'PUBLISH_COMPLETE') {
    await transitionJob({ jobId, to: 'PUBLISHED' as JobStatus, tiktokVideoId: submit.publishId });
    return NextResponse.json({ jobId, status: 'PUBLISHED', tiktokVideoId: submit.publishId, message: 'Published to TikTok.' });
  }

  if (status === 'FAILED' || status === 'FAILED_AUDIT') {
    const failed = await transitionJob({ jobId, to: 'FAILED' as JobStatus, errorMessage: `TikTok status: ${status}`, tiktokVideoId: submit.publishId });
    if (failed.status !== 'REFUNDED') await transitionJob({ jobId, to: 'REFUNDED' as JobStatus });
    return NextResponse.json({ jobId, status: 'FAILED', message: `TikTok did not publish the video (${status}). Points refunded.` }, { status: 502 });
  }

  // Still uploading / queued / awaiting audit — park as UNKNOWN, no refund.
  await transitionJob({ jobId, to: 'UNKNOWN' as JobStatus, tiktokVideoId: submit.publishId, errorMessage: `TikTok status: ${status}` });
  return NextResponse.json(
    {
      jobId,
      status: 'UNKNOWN',
      tiktokVideoId: submit.publishId,
      message: 'TikTok is still processing your post. Publishing history will update when it settles — you are only charged for confirmed published posts.',
    },
    { status: 202 },
  );
}