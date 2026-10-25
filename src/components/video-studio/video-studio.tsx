'use client';

/**
 * VIDEO STUDIO — the seller's create/manage workspace (spec §A).
 *
 * One component drives the whole lifecycle:
 *
 *   home ──▶ source (record | upload) ──▶ edit (trim, aspect, cover, text,
 *            music) ──▶ preview (server render, REAL final file with the
 *            mixed soundtrack) ──▶ details (title, listing link) ──▶ publish
 *
 * Hard rules encoded here:
 *   • nothing is ever reported as published until /api/video-studio/publish
 *     answers — the button disables, the server claims the draft, and a
 *     second tap gets the same result instead of a second listing;
 *   • the preview in the final step is the SERVER-RENDERED file, so what the
 *     seller approves is byte-for-byte what buyers will hear;
 *   • counters and metrics come only from the seller's own documents and
 *     real listing stats — no invented views, earnings or sales;
 *   • drafts live in `studioVideos` (owner-only rules) and only publish
 *     creates the public `products` document.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clapperboard,
  Eye,
  Film,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { uploadMedia } from '@/lib/media/upload-client';
import type { Product } from '@/lib/types';
import {
  CAPTION_MAX,
  OVERLAY_MAX,
  TITLE_MAX,
  TITLE_MIN,
  sanitizeAspect,
  type AspectRatio,
  type OverlayText,
  type SoundtrackSettings,
  type StudioVideoDoc,
  type TrimSettings,
} from '@/lib/studio/video-studio';
import { listAvailableTracks } from '@/lib/studio/music-catalog';
import { cn } from '@/lib/utils';
import { Recorder } from './recorder';
import { MusicPanel } from './music-panel';
import { MyVideos, type DraftRecord } from './my-videos';

type Step = 'source' | 'edit' | 'preview' | 'details';

interface SourceClip {
  mediaId: string;
  url: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number;
  width?: number;
  height?: number;
  name?: string;
}

interface MediaStatus {
  status: string;
  url?: string;
  thumbnailUrl?: string;
  error?: string | null;
}

const TIPS = [
  'Film vertically — 9:16 fills the Discovery feed and holds attention longer.',
  'Show the product in use in the first three seconds; that is where viewers decide.',
  'Good light beats an expensive camera: face a window or shoot outdoors.',
  'End with one clear action — “Message me”, “Tap to order”, or visit your shop.',
  'Keep it under 30 seconds for first-time viewers; save longer clips for demos.',
];

const CATEGORIES = [
  'fashion',
  'beauty',
  'electronics',
  'home',
  'food',
  'services',
  'health',
  'sports',
  'video',
];

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Local duration/resolution probe — the browser knows this for free. */
function probeVideoFile(file: File): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (r: { durationSeconds: number; width: number; height: number }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadedmetadata = () =>
      done({
        durationSeconds: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
      });
    v.onerror = () => done({ durationSeconds: 0, width: 0, height: 0 });
    v.src = url;
  });
}

/** Poll the engine's disk-backed status endpoint (no auth needed). */
async function pollMediaStatus(
  id: string,
  isCancelled: () => boolean,
): Promise<MediaStatus> {
  const deadline = Date.now() + 5 * 60 * 1000;
  let lastError: string | null = null;
  while (Date.now() < deadline) {
    if (isCancelled()) return { status: 'CANCELLED' };
    try {
      const res = await fetch(`/api/media/status?id=${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as MediaStatus;
        if (data.status === 'READY' || data.status === 'FAILED') return data;
        lastError = data.error ?? null;
      }
    } catch {
      /* transient network blip — keep polling */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return {
    status: 'FAILED',
    error: lastError ?? 'Processing took longer than expected. Your draft is safe — try again.',
  };
}

export function VideoStudio() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  /* ── data: my drafts + my listings ─────────────────────────── */
  const draftsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'studioVideos'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: draftDocs, isLoading: draftsLoading } = useCollection<StudioVideoDoc>(draftsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const drafts = React.useMemo(
    () => ((draftDocs ?? []) as (StudioVideoDoc & { id: string })[]).slice(),
    [draftDocs],
  );

  const metrics = React.useMemo(() => {
    const map = new Map<string, { viewCount?: number; likes?: number; salesCount?: number }>();
    for (const p of products ?? []) {
      map.set(p.id, { viewCount: p.viewCount, likes: p.likes, salesCount: p.salesCount });
    }
    return map;
  }, [products]);

  const counters = React.useMemo(() => {
    const c = { draft: 0, processing: 0, published: 0, failed: 0 };
    for (const d of drafts) {
      const s = d.status ?? 'draft';
      if (s === 'published') c.published += 1;
      else if (s === 'rendering' || s === 'publishing') c.processing += 1;
      else if (s === 'failed') c.failed += 1;
      else c.draft += 1;
    }
    return c;
  }, [drafts]);

  const totals = React.useMemo(() => {
    let views = 0;
    let likes = 0;
    let sales = 0;
    let any = false;
    for (const d of drafts) {
      const id = d.publishedDocId;
      if (!id) continue;
      const m = metrics.get(id);
      if (!m) continue;
      any = true;
      views += m.viewCount ?? 0;
      likes += m.likes ?? 0;
      sales += m.salesCount ?? 0;
    }
    return { views, likes, sales, any };
  }, [drafts, metrics]);

  /* ── session state ─────────────────────────────────────────── */
  const [view, setView] = React.useState<'home' | 'create'>('home');
  const [step, setStep] = React.useState<Step>('source');
  const [draftId, setDraftId] = React.useState<string>(newId);
  const [createdAtSet, setCreatedAtSet] = React.useState(false);
  const [showRecorder, setShowRecorder] = React.useState(false);

  const [source, setSource] = React.useState<SourceClip | null>(null);
  const [trim, setTrim] = React.useState<TrimSettings | null>(null);
  const [aspect, setAspect] = React.useState<AspectRatio>('original');
  const [overlay, setOverlay] = React.useState<OverlayText | null>(null);
  const [coverAt, setCoverAt] = React.useState(0);
  const [soundtrack, setSoundtrack] = React.useState<SoundtrackSettings | null>(null);
  const [musicTitle, setMusicTitle] = React.useState<string | null>(null);
  const [musicStreamUrl, setMusicStreamUrl] = React.useState<string | null>(null);

  const [details, setDetails] = React.useState({
    title: '',
    caption: '',
    category: '',
    hashtags: '',
    visibility: 'public' as 'public' | 'unlisted',
    location: '',
    productId: '',
    cta: '',
  });

  const [final, setFinal] = React.useState<{ mediaId: string; url: string; thumbnailUrl: string } | null>(null);
  const [pendingMediaId, setPendingMediaId] = React.useState<string | null>(null);
  const [renderState, setRenderState] = React.useState<'idle' | 'rendering' | 'ready' | 'failed'>('idle');
  const [renderError, setRenderError] = React.useState('');

  const [upload, setUpload] = React.useState<{ active: boolean; percent: number }>({
    active: false,
    percent: 0,
  });
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  const renderTokenRef = React.useRef(0);
  const editVideoRef = React.useRef<HTMLVideoElement>(null);
  const musicAudioRef = React.useRef<HTMLAudioElement>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  const duration = source?.durationSeconds ?? 0;

  /** Any edit invalidates the rendered final — never show a stale preview. */
  const markDirty = React.useCallback(() => {
    renderTokenRef.current += 1;
    if (final) setFinal(null);
    if (renderState !== 'idle') setRenderState('idle');
    setRenderError('');
  }, [final, renderState]);

  /* ── draft persistence ─────────────────────────────────────── */
  const persistDraft = React.useCallback(
    async (statusOverride?: StudioVideoDoc['status']): Promise<string | null> => {
      if (!user || !firestore || !source) return null;
      setSaving(true);
      try {
        const payload: Record<string, unknown> = {
          sellerId: user.uid,
          status: statusOverride ?? (final ? 'ready' : 'draft'),
          source,
          final,
          pendingMediaId,
          trim,
          aspect,
          overlay,
          coverAtSeconds: coverAt,
          soundtrack,
          soundtrackTitle: musicTitle,
          details: { ...details, productId: details.productId || null },
          updatedAt: serverTimestamp(),
          error: null,
        };
        if (!createdAtSet) {
          payload.createdAt = serverTimestamp();
          setCreatedAtSet(true);
        }
        await setDoc(doc(firestore, 'studioVideos', draftId), payload, { merge: true });
        return draftId;
      } catch {
        toast({
          variant: 'destructive',
          title: 'Draft not saved',
          description: 'Check your connection and try again — nothing was lost.',
        });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      user,
      firestore,
      source,
      final,
      pendingMediaId,
      trim,
      aspect,
      overlay,
      coverAt,
      soundtrack,
      musicTitle,
      details,
      draftId,
      createdAtSet,
      toast,
    ],
  );

  /* ── source acquisition ────────────────────────────────────── */
  const handleSourceFile = React.useCallback(
    async (file: File) => {
      if (!user || upload.active) return;
      if (!file.type.startsWith('video/')) {
        toast({ variant: 'destructive', title: 'Not a video', description: 'Choose an MP4, WebM, MOV or MKV file.' });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Videos must be under 100MB. Trim it on your phone first.' });
        return;
      }
      setUpload({ active: true, percent: 0 });
      try {
        const meta = await probeVideoFile(file);
        const handle = uploadMedia(file, user, (p) =>
          setUpload({ active: true, percent: p.percent ?? 0 }),
        );
        const res = await handle.promise;
        if (res.phase === 'failed' || !res.url || !handle.mediaId) {
          throw new Error(res.error || 'Upload failed. Nothing was saved — try again.');
        }
        setSource({
          mediaId: handle.mediaId,
          url: res.url,
          thumbnailUrl: res.thumbnailUrl ?? '',
          durationSeconds: meta.durationSeconds,
          width: meta.width,
          height: meta.height,
          name: file.name,
        });
        setTrim(null);
        setCoverAt(0);
        setFinal(null);
        setRenderState('idle');
        setStep('edit');
        setShowRecorder(false);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Could not upload the video.',
        });
      } finally {
        setUpload({ active: false, percent: 0 });
      }
    },
    [user, upload.active, toast],
  );

  /* ── server render (final file with soundtrack) ────────────── */
  const runRender = React.useCallback(async () => {
    if (!user || !source) return;
    const token = ++renderTokenRef.current;
    const cancelled = () => token !== renderTokenRef.current;
    setRenderState('rendering');
    setRenderError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/video-studio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          videoMediaId: source.mediaId,
          soundtrack,
          trim,
          aspect,
          overlay,
          coverAtSeconds: coverAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { mediaId?: string; error?: string };
      if (!res.ok || !data.mediaId) {
        throw new Error(data.error || 'Could not prepare the video.');
      }
      if (cancelled()) return;
      setPendingMediaId(data.mediaId);
      // Persist the pending id so a closed tab can resume the poll.
      void setDoc(
        doc(firestore, 'studioVideos', draftId),
        { pendingMediaId: data.mediaId, status: 'rendering', updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => undefined);

      const status = await pollMediaStatus(data.mediaId, cancelled);
      if (cancelled()) return;
      if (status.status === 'READY' && status.url) {
        setFinal({
          mediaId: data.mediaId,
          url: status.url,
          thumbnailUrl: status.thumbnailUrl ?? '',
        });
        setPendingMediaId(null);
        setRenderState('ready');
        void setDoc(
          doc(firestore, 'studioVideos', draftId),
          {
            status: 'ready',
            pendingMediaId: null,
            final: {
              mediaId: data.mediaId,
              url: status.url,
              thumbnailUrl: status.thumbnailUrl ?? '',
              rendered: true,
            },
            updatedAt: serverTimestamp(),
            error: null,
          },
          { merge: true },
        ).catch(() => undefined);
      } else if (status.status === 'CANCELLED') {
        setRenderState('idle');
      } else {
        throw new Error(status.error || 'Rendering failed.');
      }
    } catch (err) {
      if (cancelled()) return;
      const message = err instanceof Error ? err.message : 'Rendering failed.';
      setRenderState('failed');
      setRenderError(message);
      void setDoc(
        doc(firestore, 'studioVideos', draftId),
        { status: 'failed', error: message, updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => undefined);
    }
  }, [user, firestore, source, soundtrack, trim, aspect, overlay, coverAt, draftId]);

  /*
   * Restore the preview stream URL for a resumed draft: own uploads are
   * resolved from /api/music/mine (the uid comes from the token, so this
   * only ever sees the caller's own folder), catalogue tracks from the
   * in-memory licensed catalogue. Until it resolves, the editor simply has
   * no synced music preview — the settings themselves were never lost.
   */
  React.useEffect(() => {
    if (!soundtrack || musicStreamUrl) return;
    if (soundtrack.musicMediaId) {
      let cancelled = false;
      void (async () => {
        if (!user) return;
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/music/mine', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = (await res.json()) as { tracks?: Array<{ id: string; url: string }> };
          const match = (data.tracks ?? []).find((t) => t.id === soundtrack.musicMediaId);
          if (match && !cancelled) setMusicStreamUrl(match.url);
        } catch {
          /* offline — preview simply runs without synced audio */
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (soundtrack.catalogueTrackId) {
      const track = listAvailableTracks().find((t) => t.id === soundtrack.catalogueTrackId);
      if (track) setMusicStreamUrl(track.streamUrl);
    }
  }, [soundtrack, musicStreamUrl, user]);

  /* Auto-render on entering the preview step (and resume a pending one). */
  React.useEffect(() => {
    if (view !== 'create' || step !== 'preview') return;
    if (final) return;
    if (renderState === 'ready' || renderState === 'rendering') return;
    if (renderState === 'failed' && renderError) return;
    if (pendingMediaId && !final) {
      // Resume polling a render started before the tab was closed.
      const token = ++renderTokenRef.current;
      const cancelled = () => token !== renderTokenRef.current;
      setRenderState('rendering');
      void (async () => {
        const status = await pollMediaStatus(pendingMediaId, cancelled);
        if (cancelled()) return;
        if (status.status === 'READY' && status.url) {
          setFinal({
            mediaId: pendingMediaId,
            url: status.url,
            thumbnailUrl: status.thumbnailUrl ?? '',
          });
          setPendingMediaId(null);
          setRenderState('ready');
        } else if (status.status !== 'CANCELLED') {
          setRenderState('failed');
          setRenderError(status.error || 'Rendering failed.');
        }
      })();
      return;
    }
    void runRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, step, final, renderState, renderError, pendingMediaId]);

  /* ── preview sync (source + music before the final render) ── */
  const syncPreviewPlay = React.useCallback(() => {
    const v = editVideoRef.current;
    const a = musicAudioRef.current;
    if (!v) return;
    v.volume = soundtrack?.muteOriginal ? 0 : (soundtrack?.originalVolume ?? 1);
    if (a && soundtrack && musicStreamUrl) {
      a.volume = soundtrack.musicVolume;
      try {
        a.currentTime = Math.max(0, soundtrack.startSeconds);
      } catch {
        /* metadata not ready yet */
      }
      void a.play().catch(() => undefined);
    }
  }, [soundtrack, musicStreamUrl]);

  const syncPreviewPause = React.useCallback(() => {
    musicAudioRef.current?.pause();
  }, []);

  React.useEffect(() => {
    const a = musicAudioRef.current;
    if (!a || !soundtrack) return;
    a.volume = soundtrack.muteOriginal ? 0 : soundtrack.musicVolume;
  }, [soundtrack]);

  /* ── actions ───────────────────────────────────────────────── */
  const startNew = React.useCallback((mode: 'record' | 'upload' | 'choose') => {
    setDraftId(newId());
    setCreatedAtSet(false);
    setSource(null);
    setTrim(null);
    setAspect('original');
    setOverlay(null);
    setCoverAt(0);
    setSoundtrack(null);
    setMusicTitle(null);
    setMusicStreamUrl(null);
    setDetails({ title: '', caption: '', category: '', hashtags: '', visibility: 'public', location: '', productId: '', cta: '' });
    setFinal(null);
    setPendingMediaId(null);
    setRenderState('idle');
    setRenderError('');
    renderTokenRef.current += 1;
    setShowRecorder(mode === 'record');
    setStep('source');
    setView('create');
    if (mode === 'upload') {
      setTimeout(() => uploadInputRef.current?.click(), 100);
    }
  }, []);

  const resumeDraft = React.useCallback((d: DraftRecord) => {
    setDraftId(d.id);
    setCreatedAtSet(true);
    setSource(d.source ?? null);
    setTrim(d.trim ?? null);
    setAspect(sanitizeAspect(d.aspect));
    setOverlay(d.overlay ?? null);
    setCoverAt(d.coverAtSeconds ?? 0);
    setSoundtrack(d.soundtrack ?? null);
    setMusicTitle(d.soundtrackTitle ?? null);
    setMusicStreamUrl(null);
    setDetails({
      title: d.details?.title ?? '',
      caption: d.details?.caption ?? '',
      category: d.details?.category ?? '',
      hashtags: d.details?.hashtags ?? '',
      visibility: d.details?.visibility === 'unlisted' ? 'unlisted' : 'public',
      location: d.details?.location ?? '',
      productId: d.details?.productId ?? '',
      cta: d.details?.cta ?? '',
    });
    setFinal(
      d.final?.url
        ? { mediaId: d.final.mediaId, url: d.final.url, thumbnailUrl: d.final.thumbnailUrl ?? '' }
        : null,
    );
    setPendingMediaId(d.pendingMediaId ?? null);
    setRenderState(d.final?.url ? 'ready' : 'idle');
    setRenderError('');
    renderTokenRef.current += 1;
    setShowRecorder(false);
    setView('create');
    setStep(d.final?.url ? 'preview' : d.source ? 'edit' : 'source');
  }, []);

  const deleteDraft = React.useCallback(
    async (id: string) => {
      if (!firestore) return;
      try {
        await deleteDoc(doc(firestore, 'studioVideos', id));
        toast({ title: 'Video removed', description: 'Your listing and products were not affected.' });
      } catch {
        toast({ variant: 'destructive', title: 'Could not delete', description: 'Try again in a moment.' });
      }
    },
    [firestore, toast],
  );

  const publish = React.useCallback(async () => {
    if (!user || !final || publishing) return;
    if (details.title.trim().length < TITLE_MIN) {
      toast({ variant: 'destructive', title: 'Add a title', description: `Titles need at least ${TITLE_MIN} characters.` });
      setStep('details');
      return;
    }
    setPublishing(true);
    try {
      // Save the latest details first so the draft reflects what is published.
      await persistDraft('ready');
      const idToken = await user.getIdToken();
      const res = await fetch('/api/video-studio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ draftId, finalMediaId: final.mediaId, details }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        productId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.productId) {
        throw new Error(data.error || 'Publishing failed. Your draft is safe.');
      }
      toast({
        title: 'Video published',
        description: 'It is live in your shop and the Discovery feed.',
      });
      setView('home');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setPublishing(false);
    }
  }, [user, final, publishing, details, persistDraft, draftId, toast]);

  const dirtyDetails = (patch: Partial<typeof details>) => setDetails((d) => ({ ...d, ...patch }));

  /* ── render ────────────────────────────────────────────────── */
  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8 md:pt-6">
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleSourceFile(f);
        }}
      />
      {musicStreamUrl && (
        <audio
          ref={musicAudioRef}
          src={musicStreamUrl}
          preload="none"
          onEnded={() => {
            if (soundtrack?.loop && editVideoRef.current && !editVideoRef.current.paused) {
              const a = musicAudioRef.current;
              if (a) {
                a.currentTime = Math.max(0, soundtrack.startSeconds);
                void a.play().catch(() => undefined);
              }
            }
          }}
        />
      )}

      {view === 'home' ? (
        /* ═══════════════ HOME (§A1) ═══════════════ */
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-headline flex items-center gap-2 text-3xl font-bold tracking-tight">
                <Clapperboard className="h-7 w-7 text-primary" /> Video Studio
              </h1>
              <p className="text-muted-foreground">
                Record or upload a product video, add music, and publish it to Discovery and your shop.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => startNew('record')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Video className="mr-2 h-4 w-4" /> Record video
              </Button>
              <Button variant="outline" onClick={() => startNew('upload')} className="border-border">
                <Upload className="mr-2 h-4 w-4" /> Upload video
              </Button>
            </div>
          </div>

          {/* Counters — real documents only */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ['Drafts', counters.draft, 'resume anytime'],
                ['Processing', counters.processing, 'rendering now'],
                ['Published', counters.published, 'live in Discovery'],
                ['Failed', counters.failed, 'retry safely'],
              ] as const
            ).map(([label, value, hint]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-2xl font-black tracking-tight">{value}</p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Performance — real listing metrics, honest empty state */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-primary" /> Video performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totals.any ? (
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-2xl font-black">{totals.views.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Listing views</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black">{totals.likes.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Likes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black">{totals.sales.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Sales on linked listings</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No published videos yet — once a video is live and buyers engage, its real views,
                  likes and sales show up here. Nothing is ever estimated or invented.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Making videos that sell
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {TIPS.map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">My videos</h2>
            <span className="text-xs text-muted-foreground">{drafts.length} total</span>
          </div>
          {draftsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : (
            <MyVideos
              drafts={drafts}
              metrics={metrics}
              onResume={resumeDraft}
              onDelete={(id) => void deleteDraft(id)}
            />
          )}
        </>
      ) : (
        /* ═══════════════ CREATE FLOW ═══════════════ */
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">
                {step === 'source' && 'New video'}
                {step === 'edit' && 'Edit video'}
                {step === 'preview' && 'Preview'}
                {step === 'details' && 'Video details'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === 'source' && 'Record with your camera or choose a video from this device.'}
                {step === 'edit' && 'Trim, pick a cover, add text and a soundtrack.'}
                {step === 'preview' && 'Watch the finished file — exactly what buyers will see.'}
                {step === 'details' && 'Title, hashtags and the listing this video belongs to.'}
              </p>
            </div>
            <ol className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {(['source', 'edit', 'preview', 'details'] as Step[]).map((s, i) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border',
                      step === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border',
                    )}
                  >
                    {i + 1}
                  </span>
                  {i < 3 && <span className="h-px w-3 bg-border" />}
                </li>
              ))}
            </ol>
          </div>

          {/* ── STEP: source ─────────────────────────────────── */}
          {step === 'source' && (
            <div className="space-y-4">
              {showRecorder ? (
                <Recorder
                  onComplete={(file) => void handleSourceFile(file)}
                  onCancel={() => setShowRecorder(false)}
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setShowRecorder(true)}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center transition hover:border-primary/60"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20">
                      <Video className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-bold">Record with camera</span>
                    <span className="text-xs text-muted-foreground">
                      Vertical 9:16 works best for Discovery. Pause, resume and retake supported.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center transition hover:border-primary/60"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20">
                      <Upload className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-bold">Upload an existing video</span>
                    <span className="text-xs text-muted-foreground">
                      MP4, WebM, MOV or MKV — up to 100MB, validated before and during upload.
                    </span>
                  </button>
                </div>
              )}

              {upload.active && (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading and processing…
                    </span>
                    <span>{upload.percent}%</span>
                  </div>
                  <Progress value={upload.percent} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">
                    The video is transcoded on the server before editing starts — keep this tab open.
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setView('home')} className="text-muted-foreground">
                  Back to studio
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: edit ───────────────────────────────────── */}
          {step === 'edit' && source && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div
                  className="relative overflow-hidden rounded-2xl border border-border bg-black"
                  style={
                    aspect === '9:16'
                      ? { aspectRatio: '9 / 16', maxHeight: '70vh', margin: '0 auto' }
                      : aspect === '1:1'
                        ? { aspectRatio: '1 / 1' }
                        : aspect === '16:9'
                          ? { aspectRatio: '16 / 9' }
                          : undefined
                  }
                >
                  <video
                    ref={editVideoRef}
                    src={source.url}
                    controls
                    playsInline
                    crossOrigin="anonymous"
                    onPlay={syncPreviewPlay}
                    onPause={syncPreviewPause}
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (trim && v.currentTime >= trim.endSeconds) {
                        v.pause();
                        v.currentTime = trim.startSeconds;
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (trim) v.currentTime = trim.startSeconds;
                    }}
                    className={cn(
                      'max-h-[70vh] w-full',
                      aspect === '9:16' ? 'object-contain' : 'object-cover',
                    )}
                  />
                </div>

                {/* Trim */}
                <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Trim</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {trim ? `${fmt(trim.startSeconds)} → ${fmt(trim.endSeconds)}` : `0:00 → ${fmt(duration)}`}
                      </span>
                      {trim && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setTrim(null);
                            markDirty();
                          }}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-muted-foreground">Start</span>
                    <SliderRow
                      value={trim?.startSeconds ?? 0}
                      min={0}
                      max={Math.max(0.5, (trim?.endSeconds ?? duration) - 0.5)}
                      onChange={(v) => {
                        setTrim({
                          startSeconds: v,
                          endSeconds: Math.max(v + 0.5, trim?.endSeconds ?? duration),
                        });
                        markDirty();
                        if (editVideoRef.current) editVideoRef.current.currentTime = v;
                      }}
                      label="Trim start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-muted-foreground">End</span>
                    <SliderRow
                      value={trim?.endSeconds ?? duration}
                      min={Math.min(duration, (trim?.startSeconds ?? 0) + 0.5)}
                      max={Math.max(1, duration)}
                      onChange={(v) => {
                        setTrim({
                          startSeconds: trim?.startSeconds ?? 0,
                          endSeconds: v,
                        });
                        markDirty();
                        if (editVideoRef.current) editVideoRef.current.currentTime = v;
                      }}
                      label="Trim end"
                    />
                  </div>
                </section>

                {/* Aspect + cover + text */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Aspect ratio</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['original', '9:16', '1:1', '16:9'] as AspectRatio[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            setAspect(a);
                            markDirty();
                          }}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                            aspect === a
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/50',
                          )}
                        >
                          {a === 'original' ? 'Original' : a}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      9:16 (vertical) is recommended for the Discovery feed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Cover frame</Label>
                      <span className="text-[11px] text-muted-foreground">{fmt(coverAt)}</span>
                    </div>
                    <SliderRow
                      value={coverAt}
                      min={0}
                      max={Math.max(1, duration)}
                      label="Cover frame"
                      onChange={(v) => {
                        setCoverAt(v);
                        markDirty();
                        if (editVideoRef.current) editVideoRef.current.currentTime = v;
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Text on video (optional)</Label>
                    <Input
                      value={overlay?.text ?? ''}
                      maxLength={OVERLAY_MAX}
                      placeholder="e.g. New arrivals this week"
                      onChange={(e) => {
                        const text = e.target.value;
                        setOverlay(text ? { text, position: overlay?.position ?? 'top' } : null);
                        markDirty();
                      }}
                      className="bg-background"
                    />
                    {overlay && (
                      <div className="flex gap-2">
                        {(['top', 'bottom'] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setOverlay({ ...overlay, position: pos })}
                            className={cn(
                              'rounded-full border px-3 py-1 text-[11px] font-bold capitalize transition',
                              overlay.position === pos
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground',
                            )}
                          >
                            {pos} of frame
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Placed clear of the phone interface controls (top/bottom safe margins).
                    </p>
                  </div>
                </section>

                <MusicPanel
                  value={soundtrack}
                  onChange={(next) => {
                    setSoundtrack(next);
                    markDirty();
                  }}
                  title={musicTitle}
                  onTitleChange={setMusicTitle}
                  onStreamUrl={setMusicStreamUrl}
                  videoDuration={duration}
                />
              </div>

              {/* Side rail */}
              <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                    <p>Length: {trim ? fmt(trim.endSeconds - trim.startSeconds) : fmt(duration)}</p>
                    <p>Format: {aspect === 'original' ? 'original' : aspect}</p>
                    <p>Cover: {fmt(coverAt)}</p>
                    <p>
                      Music:{' '}
                      {soundtrack ? (musicTitle ?? 'selected track') : 'none (you can publish without music)'}
                    </p>
                    <p>Text: {overlay?.text ? `“${overlay.text}”` : 'none'}</p>
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="border-border"
                    disabled={saving || upload.active}
                    onClick={() => void persistDraft()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving…' : 'Save draft'}
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setStep('preview')}
                  >
                    <Play className="mr-2 h-4 w-4" /> Preview final video
                  </Button>
                  <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep('source')}>
                    Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: preview (server-rendered final) ────────── */}
          {step === 'preview' && source && (
            <div className="mx-auto max-w-3xl space-y-4">
              {renderState === 'rendering' || (final === null && renderState === 'idle') ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-bold">Preparing your final video…</p>
                  <p className="text-xs text-muted-foreground">
                    {soundtrack
                      ? 'Mixing your soundtrack into the video and generating the cover. This runs on the server and usually takes under a minute.'
                      : 'Applying your edits and generating the cover. This usually takes under a minute.'}
                  </p>
                </div>
              ) : renderState === 'failed' ? (
                <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
                  <p className="text-sm font-bold text-destructive">Could not prepare the video</p>
                  <p className="text-xs text-muted-foreground">{renderError}</p>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" onClick={() => void runRender()} className="bg-primary text-primary-foreground">
                      Try again
                    </Button>
                    <Button size="sm" variant="outline" className="border-border" onClick={() => setStep('edit')}>
                      Edit settings
                    </Button>
                  </div>
                </div>
              ) : final ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-border bg-black">
                    <video
                      src={final.url}
                      poster={final.thumbnailUrl || undefined}
                      controls
                      playsInline
                      className="max-h-[70vh] w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Final file ready — soundtrack, cover and edits are baked in. This is exactly what
                    buyers will play.
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" className="border-border" onClick={() => setStep('edit')}>
                      <Pause className="mr-2 h-4 w-4" /> Edit again
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border"
                      disabled={saving}
                      onClick={() => void persistDraft('ready')}
                    >
                      <Save className="mr-2 h-4 w-4" /> Save draft
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setStep('details')}
                    >
                      Continue to publish <Plus className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ── STEP: details + publish ──────────────────────── */}
          {step === 'details' && (
            <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div className="space-y-2">
                  <Label htmlFor="vs-title">Title *</Label>
                  <Input
                    id="vs-title"
                    value={details.title}
                    maxLength={TITLE_MAX}
                    placeholder="e.g. Hand-stitched leather tote — close-up"
                    onChange={(e) => dirtyDetails({ title: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vs-caption">Caption</Label>
                  <Textarea
                    id="vs-caption"
                    value={details.caption}
                    maxLength={CAPTION_MAX}
                    rows={4}
                    placeholder="What makes this worth buying? Add a call to action."
                    onChange={(e) => dirtyDetails({ caption: e.target.value })}
                    className="bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {details.caption.length}/{CAPTION_MAX}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={details.category || 'video'}
                      onValueChange={(v) => dirtyDetails({ category: v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c[0].toUpperCase() + c.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select
                      value={details.visibility}
                      onValueChange={(v) => dirtyDetails({ visibility: v as 'public' | 'unlisted' })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public — in Discovery</SelectItem>
                        <SelectItem value="unlisted">Unlisted — link only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vs-tags">Hashtags / keywords</Label>
                  <Input
                    id="vs-tags"
                    value={details.hashtags}
                    maxLength={300}
                    placeholder="leather, tote, handmade"
                    onChange={(e) => dirtyDetails({ hashtags: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vs-loc">Location / service area (optional)</Label>
                    <Input
                      id="vs-loc"
                      value={details.location}
                      maxLength={120}
                      placeholder="Nairobi"
                      onChange={(e) => dirtyDetails({ location: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vs-cta">Call to action (optional)</Label>
                    <Input
                      id="vs-cta"
                      value={details.cta}
                      maxLength={80}
                      placeholder="Message me to order"
                      onChange={(e) => dirtyDetails({ cta: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Linked product or service</Label>
                  <Select
                    value={details.productId || 'none'}
                    onValueChange={(v) => dirtyDetails({ productId: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose a listing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No product — general video</SelectItem>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {details.productId
                      ? 'The video is added to this listing — price, stock and images stay untouched.'
                      : 'No problem — the video still publishes to your shop and Discovery.'}
                  </p>
                </div>
              </div>

              {/* Publish rail */}
              <div className="space-y-3 md:sticky md:top-6 md:self-start">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ImagePlus className="h-4 w-4 text-primary" /> Publish check
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Final video rendered with soundtrack
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Goes to Discovery, your shop and the product page
                    </p>
                    <p className="flex items-center gap-2">
                      <Film className="h-3.5 w-3.5" />
                      {details.productId ? 'Adds video to the selected listing' : 'Creates a new video listing'}
                    </p>
                  </CardContent>
                </Card>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={publishing || !final}
                  onClick={() => void publish()}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
                    </>
                  ) : (
                    'Publish video'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-border"
                  disabled={saving}
                  onClick={() => void persistDraft()}
                >
                  <Save className="mr-2 h-4 w-4" /> Save draft
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep('preview')}>
                  Back to preview
                </Button>
                {!final && (
                  <p className="text-center text-[11px] text-destructive">
                    The final video is still processing — go back to preview and wait for it to finish.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Small labelled slider (kept local — the studio needs a fixed, simple row). */
function SliderRow({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
    />
  );
}