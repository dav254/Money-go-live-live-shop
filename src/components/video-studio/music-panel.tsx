'use client';

/**
 * MUSIC PANEL — pick, upload and mix the soundtrack (spec §A4).
 *
 * Two honest sources, no fabrications:
 *   • the seller's OWN uploads (already 30s-capped server-side by the media
 *     engine), listed from GET /api/music/mine;
 *   • Vidnov's licensed catalogue — which ships EMPTY, and the panel says so
 *     verbatim instead of pretending tracks exist.
 *
 * Uploading requires an explicit rights confirmation (§A4.5): the seller
 * affirms they own or are licensed for the file before it can be selected.
 * Every mixing control here writes into the shared, clamped
 * `SoundtrackSettings` — the same struct the server re-sanitizes, so what
 * the seller hears in preview is what ffmpeg renders.
 */

import * as React from 'react';
import { Music, Play, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { uploadMedia } from '@/lib/media/upload-client';
import { musicFolderFor, MUSIC_MAX_SECONDS } from '@/lib/media/music';
import {
  catalogueAvailability,
  listAvailableTracks,
  type CatalogueTrack,
} from '@/lib/studio/music-catalog';
import { FADE_MAX, type SoundtrackSettings } from '@/lib/studio/video-studio';
import { cn } from '@/lib/utils';

interface OwnTrack {
  id: string;
  title: string;
  url: string;
  durationSeconds: number | null;
  sizeBytes: number;
}

interface Props {
  value: SoundtrackSettings | null;
  onChange: (next: SoundtrackSettings | null) => void;
  title: string | null;
  onTitleChange: (title: string | null) => void;
  /** Current track's stream URL, so the editor can preview-sync it. */
  onStreamUrl: (url: string | null) => void;
  videoDuration: number;
}

function defaults(partial: Partial<SoundtrackSettings> = {}): SoundtrackSettings {
  return {
    startSeconds: 0,
    musicVolume: 0.6,
    originalVolume: 1,
    muteOriginal: false,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    loop: false,
    ...partial,
  };
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

export function MusicPanel({
  value,
  onChange,
  title,
  onTitleChange,
  onStreamUrl,
  videoDuration,
}: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  const [ownTracks, setOwnTracks] = React.useState<OwnTrack[]>([]);
  const [trackDuration, setTrackDuration] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [uploadError, setUploadError] = React.useState('');
  const [rightsOk, setRightsOk] = React.useState(false);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const catalogue = React.useMemo(() => listAvailableTracks(), []);
  const availability = React.useMemo(() => catalogueAvailability(), []);

  const loadOwn = React.useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/music/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { tracks?: OwnTrack[] };
      setOwnTracks(data.tracks ?? []);
    } catch {
      /* offline list stays empty — the picker still works with the catalogue */
    }
  }, [user]);

  React.useEffect(() => {
    void loadOwn();
  }, [loadOwn]);

  const stopPreview = React.useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  React.useEffect(() => stopPreview, [stopPreview]);

  const preview = React.useCallback(
    (id: string, url: string) => {
      if (playingId === id) {
        stopPreview();
        return;
      }
      stopPreview();
      const audio = new Audio(url);
      audio.volume = 0.9;
      void audio.play().catch(() => undefined);
      audioRef.current = audio;
      setPlayingId(id);
    },
    [playingId, stopPreview],
  );

  const selectOwn = (t: OwnTrack) => {
    setTrackDuration(t.durationSeconds);
    onTitleChange(t.title);
    onStreamUrl(t.url);
    onChange(defaults({ musicMediaId: t.id }));
  };

  const selectCatalogue = (t: CatalogueTrack) => {
    setTrackDuration(t.durationSeconds);
    onTitleChange(t.title);
    onStreamUrl(t.streamUrl);
    onChange(defaults({ catalogueTrackId: t.id }));
  };

  const uploadTrack = async (file: File) => {
    if (!user) return;
    setUploadError('');
    if (!file.type.startsWith('audio/')) {
      setUploadError('Choose an audio file (MP3, M4A, WAV, OGG or FLAC).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('That file is over 20MB. Use a smaller clip.');
      return;
    }
    const duration = await probeDuration(file);
    if (duration !== null && duration > MUSIC_MAX_SECONDS + 0.5) {
      setUploadError(`Music must be ${MUSIC_MAX_SECONDS}s or shorter — this file is ${Math.round(duration)}s.`);
      return;
    }
    if (!rightsOk) {
      setUploadError('Confirm you own or are licensed for this music before uploading.');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const handle = uploadMedia(file, user, (p) => setUploadPct(p.percent ?? 0), {
        folder: musicFolderFor(user.uid),
      });
      const res = await handle.promise;
      if (res.phase === 'failed' || !handle.mediaId) {
        throw new Error(res.error || 'Upload failed.');
      }
      setTrackDuration(duration);
      onTitleChange(file.name.replace(/\.[^.]+$/, ''));
      onStreamUrl(res.url ?? null);
      onChange(defaults({ musicMediaId: handle.mediaId }));
      toast({ title: 'Music added', description: 'Your track is attached to this video.' });
      await loadOwn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setUploadError(message);
      toast({ variant: 'destructive', title: 'Music upload failed', description: message });
    } finally {
      setUploading(false);
    }
  };

  const patch = (p: Partial<SoundtrackSettings>) => {
    if (!value) return;
    onChange({ ...value, ...p });
  };

  const startMax = Math.max(
    1,
    Math.min(trackDuration ?? videoDuration ?? 1, (trackDuration ?? 1) - 0.5),
  );

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Music className="h-4 w-4 text-primary" /> Background music
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            optional
          </span>
        </h3>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              onTitleChange(null);
              onStreamUrl(null);
              setTrackDuration(null);
            }}
            className="text-muted-foreground"
          >
            Remove music
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/flac"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void uploadTrack(f);
        }}
      />

      <Tabs defaultValue="yours">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="yours">Your music</TabsTrigger>
          <TabsTrigger value="library">Vidnov library</TabsTrigger>
        </TabsList>

        <TabsContent value="yours" className="space-y-3 pt-2">
          <label
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-xs leading-relaxed',
              value?.musicMediaId && 'border-primary/40',
            )}
          >
            <Checkbox
              checked={rightsOk}
              onCheckedChange={(v) => setRightsOk(v === true)}
              className="mt-0.5"
            />
            <span>
              I confirm I <strong>own this track or have permission</strong> to use it on Vidnov,
              including for commercial product promotion. Only upload music you are licensed for.
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-border"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload an audio file (max {MUSIC_MAX_SECONDS}s)
          </Button>

          {uploading && <Progress value={uploadPct} className="h-2" />}
          {uploadError && <p className="text-[11px] font-medium text-destructive">{uploadError}</p>}

          <div className="space-y-1.5">
            {ownTracks.length === 0 ? (
              <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                You have not uploaded any music yet. Upload a licensed clip above, or publish
                without music — music is never required.
              </p>
            ) : (
              ownTracks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border border-border bg-background p-2.5',
                    value?.musicMediaId === t.id && 'border-primary/60 bg-primary/5',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => preview(t.id, t.url)}
                    aria-label={`Preview ${t.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
                  >
                    {playingId === t.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.durationSeconds ? `${fmt(t.durationSeconds)} · ` : ''}
                      your upload
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={value?.musicMediaId === t.id ? 'default' : 'outline'}
                    onClick={() => selectOwn(t)}
                    className="h-7 shrink-0 text-[11px]"
                  >
                    {value?.musicMediaId === t.id ? 'Selected' : 'Use'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-2 pt-2">
          {catalogue.length === 0 ? (
            <div className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Music not available yet</p>
              {availability.reason}
              <p className="mt-2">You can still publish this video without music.</p>
            </div>
          ) : (
            catalogue.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-border bg-background p-2.5',
                  value?.catalogueTrackId === t.id && 'border-primary/60 bg-primary/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => preview(t.id, t.streamUrl)}
                  aria-label={`Preview ${t.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
                >
                  {playingId === t.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{t.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {t.artist} · licensed: {t.licence.licenceId}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={value?.catalogueTrackId === t.id ? 'default' : 'outline'}
                  onClick={() => selectCatalogue(t)}
                  className="h-7 shrink-0 text-[11px]"
                >
                  {value?.catalogueTrackId === t.id ? 'Selected' : 'Use'}
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Mixing controls (spec §A4.2) ─────────────────────────── */}
      {value && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Music mix</Label>
            {title && <span className="truncate text-[11px] text-muted-foreground">{title}</span>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Start at {fmt(value.startSeconds)}</span>
              <span>{trackDuration ? `track ${fmt(trackDuration)}` : ''}</span>
            </div>
            <Slider
              value={[value.startSeconds]}
              min={0}
              max={Math.max(1, Math.floor(startMax))}
              step={0.5}
              onValueChange={([v]) => patch({ startSeconds: v })}
              aria-label="Music start position"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Music volume</span>
              <span>{Math.round(value.musicVolume * 100)}%</span>
            </div>
            <Slider
              value={[value.musicVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => patch({ musicVolume: v })}
              aria-label="Music volume"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Original audio</span>
                <span>{value.muteOriginal ? 'muted' : `${Math.round(value.originalVolume * 100)}%`}</span>
              </div>
              <Slider
                value={[value.muteOriginal ? 0 : value.originalVolume]}
                min={0}
                max={1}
                step={0.05}
                disabled={value.muteOriginal}
                onValueChange={([v]) => patch({ originalVolume: v, muteOriginal: false })}
                aria-label="Original video audio volume"
              />
            </div>
            <div className="flex items-center gap-2 pt-3">
              <Switch
                checked={value.muteOriginal}
                onCheckedChange={(v) => patch({ muteOriginal: v, originalVolume: v ? 0 : 1 })}
                aria-label="Mute original audio"
              />
              <span className="text-[11px] font-medium">Mute original</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Fade in</span>
                <span>{value.fadeInSeconds}s</span>
              </div>
              <Slider
                value={[value.fadeInSeconds]}
                min={0}
                max={FADE_MAX}
                step={0.5}
                onValueChange={([v]) => patch({ fadeInSeconds: v })}
                aria-label="Music fade in"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Fade out</span>
                <span>{value.fadeOutSeconds}s</span>
              </div>
              <Slider
                value={[value.fadeOutSeconds]}
                min={0}
                max={FADE_MAX}
                step={0.5}
                onValueChange={([v]) => patch({ fadeOutSeconds: v })}
                aria-label="Music fade out"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="text-xs">
              Loop music when the video is longer than the track
              <span className="block text-[10px] text-muted-foreground">
                Off means the music stops when the track ends.
              </span>
            </span>
            <Switch
              checked={value.loop}
              onCheckedChange={(v) => patch({ loop: v })}
              aria-label="Loop music"
            />
          </label>
        </div>
      )}
    </section>
  );
}