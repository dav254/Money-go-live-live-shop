import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { getPostizConfig, postizListChannels, type PostizChannel, type PostizErrorClass } from '@/lib/postiz/client';

export const runtime = 'nodejs';

/**
 * GET /api/admin/postiz/status — is the Postiz integration configured, is the
 * instance reachable, is the API key accepted, which channels exist, and what
 * did recent attempts look like.
 *
 * Admin only. Returns presence/health facts and public channel metadata —
 * never the API key, never the URL of anything internal, never upstream body
 * text.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const config = getPostizConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      reachable: false,
      authOk: false,
      errorClass: 'not_configured',
      channels: [],
      recent: [],
      hint: 'Set POSTIZ_API_URL and POSTIZ_API_KEY (server-only) — see ops/postiz/README.md.',
    });
  }

  const probe = await postizListChannels(config);
  const channels: PostizChannel[] = probe.ok && Array.isArray(probe.value) ? probe.value : [];

  // Recent attempts — best effort; a store hiccup must not break the panel.
  let recent: Array<Record<string, unknown>> = [];
  try {
    const snap = await db
      .collection('postizLog')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get();
    recent = snap.docs.map((doc) => {
      const d = (doc.data() ?? {}) as Record<string, unknown>;
      return {
        at: typeof d.at === 'string' ? d.at : '',
        status: typeof d.status === 'string' ? d.status : '',
        productId: typeof d.productId === 'string' ? d.productId : '',
        productName: typeof d.productName === 'string' ? d.productName : '',
        channels: Array.isArray(d.channels) ? d.channels.length : 0,
        postCount: Array.isArray(d.postIds) ? d.postIds.length : 0,
        ...(typeof d.errorClass === 'string' ? { errorClass: d.errorClass } : {}),
      };
    });
  } catch {
    recent = [];
  }

  return NextResponse.json({
    configured: true,
    // 200 from GET /integrations proves both reachability AND a valid key.
    reachable: probe.ok,
    authOk: probe.ok,
    ...(probe.errorClass ? { errorClass: probe.errorClass as PostizErrorClass } : {}),
    channels: channels.map((c) => ({
      id: c.id,
      provider: c.identifier,
      name: c.name,
      ...(c.profile ? { profile: c.profile } : {}),
      disabled: c.disabled,
    })),
    recent,
  });
}
