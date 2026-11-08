import { NextResponse } from 'next/server';

import {
  ANDROID_PACKAGE_NAME,
  buildAssetLinks,
  parseFingerprints,
} from '@/lib/android/assetlinks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/assetlinks.json
 *
 * Digital Asset Links for the Vidnov Android package. Without this file Android
 * shows a browser address bar above the app and Play review treats the package
 * as a web wrapper.
 *
 * The certificate fingerprint comes from `ANDROID_APP_SHA256` (one or several
 * comma-separated — Play App Signing has its own certificate, separate from a
 * local upload key). While it is unset this route answers 404 with an explicit
 * reason: a placeholder fingerprint would fail verification silently and be
 * impossible to debug.
 */
export async function GET() {
  const fingerprints = parseFingerprints(process.env.ANDROID_APP_SHA256);

  if (fingerprints.length === 0) {
    return NextResponse.json(
      {
        error: 'No Android signing certificate configured.',
        detail:
          'Set ANDROID_APP_SHA256 (SHA-256 of the app signing certificate, as keytool or Play Console prints it) and restart the server.',
        package: ANDROID_PACKAGE_NAME,
      },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(buildAssetLinks(fingerprints), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
