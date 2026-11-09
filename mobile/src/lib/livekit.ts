import { AudioSession, registerGlobals } from '@livekit/react-native';

/**
 * LIVEKIT — the one place the React Native WebRTC globals are installed.
 *
 * LiveKit's React Native client needs `registerGlobals()` called before any
 * `Room` is constructed; calling it twice is harmless. Audio on Android also
 * needs an explicit audio session around the call, otherwise the seller's mic
 * and the buyer's playback both go silent after a route change.
 *
 * Only live screens import this module, so the cost is paid when someone opens
 * a stream, not at app start.
 */
registerGlobals();

export async function startLiveAudio(): Promise<void> {
  try {
    await AudioSession.startAudioSession();
  } catch {
    // A device that refuses the audio session still shows the video; the
    // screens surface the failure through the stream itself, not a crash.
  }
}

export async function stopLiveAudio(): Promise<void> {
  try {
    await AudioSession.stopAudioSession();
  } catch {
    /* nothing to release */
  }
}
