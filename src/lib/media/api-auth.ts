import { getAuth } from 'firebase-admin/auth';

/**
 * Verifies a Firebase ID token from an API request.
 * Accepts `Authorization: Bearer <idToken>` (used by the upload client).
 * Returns the decoded uid, or null when unauthenticated.
 */
export async function verifyRequestUser(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
