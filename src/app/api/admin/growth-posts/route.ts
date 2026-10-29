/**
 * /api/admin/growth-posts — the Growth Post approval queue API.
 *
 * Authorization: `verifyAdminUid` (Bearer token) — the same admin definition
 * every other admin route uses.
 *
 *   GET  ?status=  → { posts, counts, providers }  (bounded, sanitized)
 *   POST actions:
 *     { action: 'draft',   limit? }              → one bounded draft run
 *     { action: 'decide',  id, decision, reason? }→ approve / reject
 *     { action: 'publish', id, channel }          → copy | email (gated)
 *
 * Honesty: responses carry the record and the provider status derived from
 * env presence only. A publish that the provider rejected comes back as
 * `outcome: 'failed'` with the post already marked failed — never as a
 * success, and never as "published to social" (no such channel exists yet).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { growthProviderStatuses } from '@/lib/vidnov-core/growth-posts/drafts';
import {
  GrowthPostsError,
  decideGrowthPost,
  growthCounts,
  listGrowthPosts,
  publishGrowthPost,
  runGrowthDraftJob,
} from '@/lib/vidnov-core/growth-posts/service';
import {
  GROWTH_POST_STATES,
  GROWTH_PUBLISH_CHANNELS,
  type GrowthPostState,
  type GrowthPublishChannel,
} from '@/lib/vidnov-core/growth-posts/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function errorStatus(code: GrowthPostsError['code']): number {
  switch (code) {
    case 'not_found': return 404;
    case 'invalid_transition': return 409;
    case 'not_configured': return 409;
    case 'no_recipient': return 409;
    case 'store_unavailable': return 503;
    default: return 400;
  }
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const requested = request.nextUrl.searchParams.get('status') ?? '';
    const status = (GROWTH_POST_STATES as readonly string[]).includes(requested)
      ? (requested as GrowthPostState)
      : undefined;

    const [posts, counts] = await Promise.all([
      listGrowthPosts(db, { status }),
      growthCounts(db),
    ]);

    return NextResponse.json({ posts, counts, providers: growthProviderStatuses() });
  } catch (error) {
    if (error instanceof GrowthPostsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: errorStatus(error.code) });
    }
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/growth-posts] list failed');
    return NextResponse.json({ error: 'Growth posts are unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: {
    action?: string;
    id?: string;
    decision?: string;
    reason?: string;
    channel?: string;
    limit?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    switch (body.action) {
      case 'draft': {
        const report = await runGrowthDraftJob({ db, actorUid: adminUid, limit: body.limit });
        return NextResponse.json({ report });
      }

      case 'decide': {
        if (!body.id || (body.decision !== 'approve' && body.decision !== 'reject')) {
          return NextResponse.json({ error: 'An id and a decision of approve|reject are required.' }, { status: 400 });
        }
        const post = await decideGrowthPost(db, {
          id: body.id,
          decision: body.decision,
          actorUid: adminUid,
          ...(body.reason ? { reason: body.reason } : {}),
        });
        return NextResponse.json({ post });
      }

      case 'publish': {
        if (!body.id) {
          return NextResponse.json({ error: 'A post id is required.' }, { status: 400 });
        }
        if (!(GROWTH_PUBLISH_CHANNELS as readonly string[]).includes(body.channel ?? '')) {
          return NextResponse.json(
            { error: `channel must be one of: ${GROWTH_PUBLISH_CHANNELS.join(', ')}.` },
            { status: 400 },
          );
        }
        const result = await publishGrowthPost(db, {
          id: body.id,
          channel: body.channel as GrowthPublishChannel,
          actorUid: adminUid,
        });
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof GrowthPostsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: errorStatus(error.code) });
    }
    console.error('[core/growth-posts] action failed');
    return NextResponse.json({ error: 'The action could not complete.' }, { status: 500 });
  }
}
