
// This file is no longer used for the peer-to-peer streaming solution and can be deleted later.
// We will keep it for now to avoid breaking any potential (though unlikely) imports.

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json({ 
      error: 'This endpoint is deprecated.', 
      message: 'Live streaming is now handled via a peer-to-peer connection.'
    }, { status: 410 });
}
