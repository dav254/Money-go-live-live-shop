
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary for the server node
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Health check node for Cloudinary connectivity.
 */
export async function healthCheck() {
    const config = cloudinary.config();
    if (config.cloud_name && config.api_key && config.api_secret) {
<<<<<<< HEAD
        try {
            // Ping Cloudinary to verify credentials and service availability
            await cloudinary.api.ping();
            return { status: 'operational' };
        } catch (error) {
            console.error('Cloudinary health check failed:', error);
            return { status: 'degraded', message: 'Cloudinary service is unreachable.' };
        }
=======
        return { status: 'operational' };
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
    }
    return { status: 'outage', message: 'Cloudinary credentials missing.' };
}

/**
 * Generates a secure signature for client-side uploads.
 * This route acts as a secure proxy to authorize uploads to the ddfzqsglm node.
 */
export async function POST(request: Request) {
<<<<<<< HEAD
  // Configure Cloudinary with your credentials inside the handler
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_secret,
  });

=======
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
  try {
    const { paramsToSign } = await request.json();

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new Error('Cloudinary API secret is not configured.');
    }

    // Sign the request parameters using the secure API secret
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({ signature });

  } catch (error) {
    console.error('Signature Node Failure:', error);
    return NextResponse.json(
      { error: 'Failed to generate signature.', details: (error as Error).message }, 
      { status: 500 }
    );
  }
}
