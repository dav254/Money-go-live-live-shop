/**
 * VideoSDK transport for VIDNOV LIVE.
 *
 * Same contract as the LiveKit path — the browser only ever receives a
 * meetingId plus a short-lived token, never the SDK secret.
 *
 * Room creation needs VIDEOSDK_API_KEY + VIDEOSDK_SECRET_KEY; when only a
 * dashboard token is configured we reuse VIDEOSDK_MEETING_ID.
 */
import jwt from 'jsonwebtoken';

export function videosdkConfigured(): boolean {
  return Boolean(
    (process.env.VIDEOSDK_API_KEY && process.env.VIDEOSDK_SECRET_KEY) ||
      process.env.VIDEOSDK_MEETING_ID ||
      process.env.VIDEOSDK_TOKEN,
  );
}

/** True when the app can create fresh rooms on demand. */
export function videosdkCanCreateRooms(): boolean {
  return Boolean(process.env.VIDEOSDK_API_KEY && process.env.VIDEOSDK_SECRET_KEY);
}

/** Server-minted token when possible, otherwise the configured static one. */
export async function videosdkToken(ttlSeconds = 120 * 60): Promise<string | null> {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;
  if (API_KEY && SECRET_KEY) {
    return jwt.sign(
      { apikey: API_KEY, permissions: ['allow_join', 'allow_mod'], version: 2 },
      SECRET_KEY,
      { expiresIn: `${Math.round(ttlSeconds / 60)}m`, algorithm: 'HS256' },
    );
  }
  return process.env.VIDEOSDK_TOKEN ?? null;
}

/** Creates a room, or falls back to the pre-created meeting id. */
export async function ensureVideoSdkMeeting(): Promise<string | null> {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  if (API_KEY && SECRET_KEY) {
    const internalToken = jwt.sign(
      { apikey: API_KEY, permissions: ['allow_join', 'allow_mod'], version: 2 },
      SECRET_KEY,
      { expiresIn: '10m' },
    );
    const res = await fetch('https://api.videosdk.live/v2/rooms', {
      method: 'POST',
      headers: { authorization: internalToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { roomId?: string } | null;
    if (data?.roomId) return data.roomId;
  }

  return process.env.VIDEOSDK_MEETING_ID ?? null;
}