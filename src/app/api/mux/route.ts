
import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export async function POST(request: Request) {
  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public'],
      },
    });

    return NextResponse.json({ 
        streamKey: stream.stream_key,
        playbackId: stream.playback_ids?.[0]?.id 
    });
  } catch (error) {
    console.error('Mux API Error:', error);
    return NextResponse.json({ error: 'Could not create live stream' }, { status: 500 });
  }
}
