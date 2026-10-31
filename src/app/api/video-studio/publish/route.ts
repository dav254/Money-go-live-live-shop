import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { readStatus } from '@/lib/media/engine';
import { pbMirrorProduct } from '@/lib/pocketbase/products';
import { pingIndexNow } from '@/lib/seo/indexnow';
import {
  validatePublishDetails,
  sanitizePublishDetails,
  buildStandaloneVideoDoc,
  buildAttachToProductPatch,
} from '@/lib/studio/video-studio';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** How long a `publishing` claim is honoured before another tap may retry. */
const CLAIM_TTL_MS = 5 * 60 * 1000;

/**
 * POST /api/video-studio/publish — turn a RENDERED studio video into the
 * public listing Discovery and the public shop already read (`products`).
 *
 * Guarantees, in order:
 *   1. Bearer auth + seller/admin role (never a client-supplied seller id);
 *   2. a Firestore TRANSACTION claims the draft first: a draft that is
 *      already published returns the SAME result again, and a second
 *      concurrent tap is refused while the first is in flight — a double
 *      tap cannot create two listings;
 *   3. the final media must be READY **and owned by the caller** — the URLs
 *      written to the listing come from the server's own status record, so a
 *      client cannot publish arbitrary URLs as "its video";
 *   4. a linked product must exist and belong to the caller (admins may
 *      attach to any listing) — attaching PATCHES media fields only;
 *   5. standalone videos get a zero-stock, on-request listing (never
 *      buyable by accident, chat and shop links still live);
 *   6. only after the products write succeeds is the draft marked published
 *      and mirrored to the VPS store; a failure reopens the draft for retry.
 *
 * The public listing appears atomically with its final media — no state is
 * ever public before the playback URL and poster exist.
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only sellers can publish videos.' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const draftId = typeof body.draftId === 'string' ? body.draftId : '';
    const finalMediaId = typeof body.finalMediaId === 'string' ? body.finalMediaId : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(draftId)) {
      return NextResponse.json({ error: 'Missing draft.' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(finalMediaId)) {
      return NextResponse.json(
        { error: 'Prepare the final video before publishing.' },
        { status: 400 },
      );
    }

    const detailsError = validatePublishDetails(body.details);
    if (detailsError) {
      return NextResponse.json({ error: detailsError }, { status: 400 });
    }
    const details = sanitizePublishDetails(body.details);

    /* ── 1. claim the draft (transactional idempotency) ── */
    const draftRef = db.collection('studioVideos').doc(draftId);
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(draftRef);
      if (!snap.exists) return { outcome: 'missing' as const };
      const draft = snap.data() as Record<string, unknown>;
      if (draft.sellerId !== user.uid && !user.isAdmin) {
        return { outcome: 'forbidden' as const };
      }
      if (typeof draft.publishedDocId === 'string' && draft.publishedDocId) {
        return { outcome: 'already' as const, productId: draft.publishedDocId };
      }
      const claimedAt = typeof draft.claimedAt === 'number' ? draft.claimedAt : 0;
      const inFlight = draft.status === 'publishing' && Date.now() - claimedAt < CLAIM_TTL_MS;
      if (inFlight) return { outcome: 'in-flight' as const };
      tx.update(draftRef, {
        status: 'publishing',
        claimedAt: Date.now(),
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { outcome: 'claimed' as const };
    });

    if (claim.outcome === 'missing') {
      return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
    }
    if (claim.outcome === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (claim.outcome === 'already') {
      return NextResponse.json({
        ok: true,
        alreadyPublished: true,
        productId: claim.productId,
      });
    }
    if (claim.outcome === 'in-flight') {
      return NextResponse.json(
        { error: 'This video is already publishing — give it a moment.' },
        { status: 409 },
      );
    }

    /* ── 2. everything below runs under the claim; failures reopen it ── */
    try {
      const finalRec = await readStatus(finalMediaId);
      if (
        !finalRec ||
        finalRec.userId !== user.uid ||
        finalRec.type !== 'video' ||
        finalRec.status !== 'READY' ||
        !finalRec.url
      ) {
        await reopen(draftRef, 'The final video is not ready yet.');
        return NextResponse.json(
          { error: 'The final video is not ready yet. Wait for processing to finish.' },
          { status: 409 },
        );
      }
      const videoUrl = finalRec.url;
      const posterUrl = finalRec.thumbnailUrl ?? '';

      let productId: string;
      let createdListing = false;

      if (details.productId) {
        const productRef = db.collection('products').doc(details.productId);
        const productSnap = await productRef.get().catch(() => null);
        if (!productSnap || !productSnap.exists) {
          await reopen(draftRef, 'That listing no longer exists.');
          return NextResponse.json(
            { error: 'That listing no longer exists.' },
            { status: 404 },
          );
        }
        const product = productSnap.data() as Record<string, unknown>;
        if (product.sellerId !== user.uid && !user.isAdmin) {
          await reopen(draftRef, 'That listing belongs to another seller.');
          return NextResponse.json(
            { error: 'That listing belongs to another seller.' },
            { status: 403 },
          );
        }
        const patch = buildAttachToProductPatch({
          videoUrl,
          posterUrl,
          existingVideoUrls: product.videoUrls ?? (product.videoUrl ? [product.videoUrl] : []),
          existingPosters: product.videoThumbnailUrls ?? [],
          updatedAt: FieldValue.serverTimestamp(),
        });
        await productRef.update(patch);
        productId = details.productId;
        await mirror(productId, patch);
      } else {
        const doc = buildStandaloneVideoDoc({
          sellerId: user.uid,
          details,
          videoUrl,
          posterUrl,
          studioVideoId: draftId,
          createdAt: FieldValue.serverTimestamp(),
        });
        const created = await db.collection('products').add(doc);
        productId = created.id;
        createdListing = true;
        await mirror(productId, null);
      }

      /* ── 3. mark published (after the public write succeeded) ── */
      await draftRef.update({
        status: 'published',
        publishedDocId: productId,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        claimedAt: FieldValue.delete(),
        details: {
          title: details.title,
          caption: details.caption,
          category: details.category,
          hashtags: details.hashtags,
          visibility: details.visibility,
          location: details.location,
          productId: details.productId ?? null,
          cta: details.cta ?? '',
        },
        final: {
          mediaId: finalRec.id,
          url: videoUrl,
          thumbnailUrl: posterUrl,
          rendered: finalRec.status === 'READY',
        },
        error: null,
      } as Record<string, unknown>);

      return NextResponse.json({ ok: true, productId, createdListing, videoUrl, posterUrl });
    } catch (err) {
      console.error('[video-studio/publish] failed mid-publish');
      await reopen(draftRef, 'Publishing failed. Your draft is safe — try again.');
      return NextResponse.json(
        { error: 'Publishing failed. Your draft is safe — try again.' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[video-studio/publish] unexpected error');
    return NextResponse.json(
      { error: 'Publishing failed. Your draft is safe — try again.' },
      { status: 500 },
    );
  }
}

/** Reopen a claimed draft after a failure so the seller can retry. */
async function reopen(
  draftRef: DocumentReference,
  message: string,
): Promise<void> {
  try {
    await draftRef.update({
      status: 'failed',
      error: message,
      claimedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * PocketBase mirror (same fire-and-forget contract as /api/products/sync):
 * the VPS copy is secondary — a mirror failure never fails the seller's
 * publish. The create case re-reads the authoritative doc so only a real
 * Firestore document crosses into the mirror.
 */
async function mirror(productId: string, patch: Record<string, unknown> | null): Promise<void> {
  // A studio publish is a listing going live — ping the search index now
  // (own opt-in flag inside `pingIndexNow`; fire-and-forget, never throws).
  void pingIndexNow([`/products/${productId}`]);
  try {
    let data: Record<string, unknown> | null = patch;
    if (!data) {
      const snap = await db.collection('products').doc(productId).get();
      data = (snap.data() ?? {}) as Record<string, unknown>;
    }
    await pbMirrorProduct(productId, scrub(data));
  } catch {
    /* best-effort */
  }
}

/** Timestamps/FieldValue → JSON-safe values for the PocketBase round-trip. */
function scrub(value: unknown): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.map(walk);
    const maybeDate = v as { toDate?: () => Date };
    if (typeof maybeDate.toDate === 'function') {
      try {
        return maybeDate.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const cleaned = walk(val);
        if (cleaned !== null || val === null) out[k] = cleaned;
      }
      return out;
    }
    return null;
  };
  return walk(value) as Record<string, unknown>;
}