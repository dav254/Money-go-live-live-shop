import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary for the server node
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Every upload MUST land inside the uploading seller's own folder:
 *   sellers/{sellerId}/products
 * This keeps the media library organised per seller and lets us track
 * (and, if ever needed, clean up) each seller's storage usage.
 */
const ALLOWED_FOLDER = /^sellers\/[A-Za-z0-9_-]{6,128}\/products$/;

const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video']);

/**
 * Health check node for Cloudinary connectivity.
 */
export async function healthCheck() {
    const config = cloudinary.config();
    if (config.cloud_name && config.api_key && config.api_secret) {
        return { status: 'operational' };
    }
    return { status: 'outage', message: 'Cloudinary credentials missing.' };
}

/**
 * Generates a secure, scoped signature for client-side uploads.
 *
 * The client no longer decides what it can sign — it only tells us which
 * seller folder and media type it wants, and we validate + sign here:
 *  - folder must match `sellers/{sellerId}/products` (no arbitrary paths)
 *  - resource type must be `image` or `video`
 *  - only `timestamp` + `folder` are signed, so Cloudinary itself rejects
 *    any upload where the client tampers with either value.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const folder = typeof body?.folder === 'string' ? body.folder : '';
    const resourceType = typeof body?.resourceType === 'string' ? body.resourceType : 'image';

    if (!ALLOWED_FOLDER.test(folder)) {
      return NextResponse.json(
        { error: 'Invalid upload folder. Expected: sellers/{sellerId}/products' },
        { status: 400 },
      );
    }

    if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return NextResponse.json(
        { error: 'Invalid resource type. Allowed: image, video' },
        { status: 400 },
      );
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new Error('Cloudinary API secret is not configured.');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({ signature, timestamp, folder, resourceType });

  } catch (error) {
    console.error('Signature Node Failure:', error);
    return NextResponse.json(
      { error: 'Failed to generate signature.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
