
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Health check function for this API endpoint
export async function healthCheck() {
    const config = cloudinary.config();
    if (config.cloud_name && config.api_key && config.api_secret) {
        // You could add a ping to Cloudinary API here for a more robust check
        return { status: 'operational' };
    }
    return { status: 'outage', message: 'Cloudinary credentials are not configured.' };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle health check requests
    if (body.action === 'health_check') {
        const health = await healthCheck();
        return NextResponse.json(health);
    }
    
    const { paramsToSign } = body;

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new Error('Cloudinary API secret is not configured.');
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({ signature });

  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    return NextResponse.json(
      { error: 'Error generating signature.', details: (error as Error).message }, 
      { status: 500 }
    );
  }
}
