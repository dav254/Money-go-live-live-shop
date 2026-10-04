'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Upload, X, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AI Studio workspace (spec §4–7): one component, four modes. Talks ONLY to
 * the Vidnov AI Gateway (/api/ai/generate) — provider, pricing and points
 * are handled server-side, so this UI never changes when engines change.
 */

export type StudioMode = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'image-animation';

export interface AiJobSummary {
  jobId: string;
  status?: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
}

interface AiStudioWorkspaceProps {
  mode: StudioMode;
  onCreated?: (job: AiJobSummary) => void;
  className?: string;
  /** Prefilled prompt (e.g. entered from a product or request). */
  initialPrompt?: string;
  /** Cost in AI points, shown next to the generate button. */
  pointsCost?: number;
}

const ANIMATION_PRESETS: { value: string; label: string }[] = [
  { value: 'camera-movement', label: 'Camera movement' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pan', label: 'Pan' },
  { value: 'motion', label: 'Natural motion' },
  { value: 'product-showcase', label: 'Product showcase' },
  { value: 'cinematic', label: 'Cinematic movement' },
];

const PLACEHOLDER: Record<StudioMode, string> = {
  'text-to-image': 'Describe the image you want — a studio shot of handmade leather sandals at golden hour…',
  'image-to-image': 'Describe the change — e.g. “Create a clean professional advertisement background for this product.”',
  'text-to-video': 'Describe your video — a slow pan across a furnished living room, warm evening light…',
  'image-to-video': 'Movement prompt — e.g. “Slow camera movement around the product, commercial lighting.”',
  'image-animation': 'Optional extra direction — pick a preset above and add details if you like.',
};

/** Prompt label per mode (spec §2–5 interface copy). */
const PROMPT_LABEL: Record<StudioMode, string> = {
  'text-to-image': 'Prompt',
  'image-to-image': 'Instruction',
  'text-to-video': 'Prompt',
  'image-to-video': 'Movement prompt',
  'image-animation': 'Animation instruction',
};

const VIDEO_MODES: StudioMode[] = ['text-to-video', 'image-to-video', 'image-animation'];

export function AiStudioWorkspace({ mode, onCreated, className, initialPrompt, pointsCost }: AiStudioWorkspaceProps) {
  const { user } = useUser();
  const [prompt, setPrompt] = React.useState(initialPrompt ?? '');
  const [aspectRatio, setAspectRatio] = React.useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [quality, setQuality] = React.useState<'standard' | 'high'>('standard');
  const [durationSeconds, setDurationSeconds] = React.useState(8);
  const [preset, setPreset] = React.useState('camera-movement');
  const [image, setImage] = React.useState<{ base64: string; mime: string; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialPrompt !== undefined) setPrompt(initialPrompt);
  }, [initialPrompt]);

  const needsImage = mode === 'image-to-video' || mode === 'image-animation' || mode === 'image-to-image';

  const pickImage = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large (max 10MB).');
      return;
    }
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    setImage({ base64: btoa(binary), mime: file.type, name: file.name });
    setError(null);
  };

  const generate = async () => {
    if (!user) return;
    if (!needsImage && !prompt.trim()) {
      setError('Describe what you want to create.');
      return;
    }
    if (needsImage && !image) {
      setError('Choose an image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          prompt: prompt.trim() || undefined,
          imageBase64: image?.base64,
          imageMime: image?.mime,
          animationPreset: mode === 'image-animation' ? preset : undefined,
          aspectRatio,
          quality,
          durationSeconds: VIDEO_MODES.includes(mode) ? durationSeconds : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not start the generation.');
      onCreated?.({ jobId: body.jobId });
      setPrompt('');
      setImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('space-y-5', className)}>
      {/* Source image for image→video / animation */}
      {needsImage && (
        <div className="space-y-2">
          <Label>Image</Label>
          {image ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${image.mime};base64,${image.base64}`}
                alt="Source"
                className="h-36 rounded-xl border object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-muted/60"
            >
              <Upload className="h-5 w-5" />
              Upload an image (phone, media library, product photo)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void pickImage(e.target.files?.[0])}
          />
        </div>
      )}

      {mode === 'image-animation' && (
        <div className="space-y-2">
          <Label>Animation type</Label>
          <div className="flex flex-wrap gap-2">
            {ANIMATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition',
                  preset === p.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{PROMPT_LABEL[mode]}</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={PLACEHOLDER[mode]}
          className="rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aspect ratio</Label>
          <div className="flex gap-2">
            {(['1:1', '16:9', '9:16'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setAspectRatio(r)}
                className={cn(
                  'flex-1 rounded-xl border px-2 py-2 text-xs font-black transition',
                  aspectRatio === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Quality</Label>
          <div className="flex gap-2">
            {(['standard', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={cn(
                  'flex-1 rounded-xl border px-2 py-2 text-xs font-black uppercase transition',
                  quality === q
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {VIDEO_MODES.includes(mode) && (
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="flex gap-2">
            {[4, 6, 8].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationSeconds(d)}
                className={cn(
                  'flex-1 rounded-xl border px-2 py-2 text-xs font-black transition',
                  durationSeconds === d
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        onClick={generate}
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] py-6 font-black uppercase tracking-wide shadow-lg shadow-primary/25"
      >
        {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
        {mode === 'text-to-image' && 'Generate Image'}
        {mode === 'image-to-image' && 'Create Variation'}
        {mode === 'text-to-video' && 'Generate Video'}
        {mode === 'image-to-video' && 'Create Video'}
        {mode === 'image-animation' && 'Animate'}
        {typeof pointsCost === 'number' && (
          <span className="ml-2 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-black tracking-wide">
            {pointsCost} pts
          </span>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Wand2 className="h-3 w-3" />
        Points are charged when the job starts and refunded automatically if it fails.
      </p>
    </div>
  );
}
