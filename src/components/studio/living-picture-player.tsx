'use client';

/**
 * LIVING PICTURE — the playback surface for a still photo with OPTIONAL music.
 *
 * ## The rules this component enforces (spec §B3)
 *
 *   • **No autoplay, ever.** The `<audio>` element is created but never
 *     `play()`ed until the viewer taps the play control. On mobile that tap is
 *     also what grants the browser's audio permission, so this is not just a
 *     courtesy — it is the only way audio is allowed to start at all.
 *   • **The image is always the star.** Audio is a garnish. If the track fails
 *     to load (404, codec, offline), the photo stays fully visible and the
 *     control shows a clear "music unavailable" state — the picture never
 *     disappears because of an audio problem.
 *   • **A mute/stop is always reachable.** Playing implies a visible pause;
 *     the control toggles play/pause and stops cleanly on unmount.
 *   • **Ordinary photos are unaffected.** A Living Picture with NO track
 *     simply does not render a play control — it is an ordinary photo, and
 *     music is never forced onto it.
 *
 * ## Caching
 * The audio `src` is a same-origin URL (the studio's media pipeline or a
 * `/music/…` file). The browser caches it, so a viewer who scrolls back does
 * not re-download the track — addressing the "don't fetch the same audio
 * repeatedly" requirement without inventing a streaming service.
 */

import * as React from 'react';
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LivingPictureTrack {
  id: string;
  title: string;
  artist: string;
  streamUrl: string;
  durationSeconds?: number;
}

export function LivingPicturePlayer({
  imageUrl,
  alt,
  track,
  className,
  /**
   * How the still is fitted into its frame. `cover` (default) fills the box —
   * right for a framed preview. `contain` keeps the WHOLE photo inside it,
   * which is what the Discovery feed needs: a product shot must never have
   * its edges cropped away by a tall phone viewport. Never stretches: both
   * preserve the source aspect ratio.
   */
  fit = 'cover',
  /** Called when the audio fails, so the host can surface a message. */
  onError,
}: {
  imageUrl: string;
  alt: string;
  /** null/undefined = an ordinary photo; no control is rendered. */
  track?: LivingPictureTrack | null;
  className?: string;
  fit?: 'cover' | 'contain';
  onError?: (message: string) => void;
}) {
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Stop audio when the track changes or the component unmounts — a photo
  // scrolled off-screen must not keep playing.
  React.useEffect(() => {
    setIsPlaying(false);
    setFailed(false);
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    };
  }, [track?.id]);

  const toggle = React.useCallback(async () => {
    const el = audioRef.current;
    if (!el || !track) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }
    try {
      // The tap is the user gesture that unlocks mobile audio.
      await el.play();
      setIsPlaying(true);
    } catch {
      // Autoplay policy or a load error — keep the photo, flag the audio.
      setFailed(true);
      setIsPlaying(false);
      onError?.('This track could not be played.');
    }
  }, [isPlaying, track, onError]);

  const toggleMute = React.useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const next = !muted;
    el.muted = next;
    setMuted(next);
  }, [muted]);

  // No track → this is an ordinary photo. Render nothing extra.
  if (!track) {
    return <img src={imageUrl} alt={alt} className={cn('h-full w-full', fitClass, className)} />;
  }

  return (
    <div className={cn('relative h-full w-full', className)}>
      <img src={imageUrl} alt={alt} className={cn('h-full w-full', fitClass)} />

      {/* The audio element itself — never autoplayed. */}
      <audio
        ref={audioRef}
        src={track.streamUrl}
        loop
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setFailed(true);
          setIsPlaying(false);
          onError?.('Music could not be loaded.');
        }}
      />

      {/* Track chip — always shows what is (or is not) playing. */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
        <Music className="h-3 w-3" />
        {failed ? 'Music unavailable' : `${track.title} · ${track.artist}`}
      </div>

      {/* Intentional play/pause control — the only thing that starts audio. */}
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={isPlaying ? 'Pause music' : 'Play music'}
        className={cn(
          'absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80',
          failed && 'opacity-50',
        )}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>

      {/* Mute — reachable whenever there is audio at all. */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-4 right-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
