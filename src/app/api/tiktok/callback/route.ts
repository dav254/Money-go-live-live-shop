// This file is no longer needed as sellers will not be connecting their own TikTok accounts.
// The new model uses a central Go Earn account to post videos.
// The file is kept to prevent build errors from potential lingering imports, but its functionality is removed.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'This endpoint is no longer in use.' }, { status: 410 });
}
