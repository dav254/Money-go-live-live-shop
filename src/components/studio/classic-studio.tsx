'use client';

/**
 * VIDNOV CLASSIC STUDIO — the working photo editor + promotional design tool.
 *
 * This is a REAL editor, not a mockup. Every control mutates a composition
 * state that is rendered to a canvas by `renderStudio()` — the same function
 * the export path uses — so what the seller arranges is what gets encoded and
 * uploaded through the existing VPS media pipeline (`uploadMedia`). The
 * original upload is never mutated: the studio renders a SEPARATE derived
 * image (spec A4).
 *
 * ## Import & capture (A1)
 *   • Gallery: a hidden `<input type=file accept=image/*>`.
 *   • Camera: the same input with `capture="environment"`, which on a capable
 *     mobile browser opens the rear camera directly. Permission handling is
 *     the browser's own; on denial (or on a desktop with no camera) the seller
 *     simply uses the gallery input — there is no dead-end.
 *   • Preview / replace / remove are all wired to the same source blob.
 *
 * ## Edit tools (A2)
 * Crop presets, rotate, flip, and four tonal sliders (brightness, contrast,
 * saturation, warmth) plus reusable looks. Undo/redo keep a bounded history;
 * a press-and-hold "Compare" shows the untouched original.
 *
 * ## Design studio (A3)
 * Text, price/sale-price, badges, and shapes — positioned by dragging on the
 * canvas, styled from a compact inspector. Overlays are stored normalised so a
 * design laid out on a square maps onto a story without rescaling.
 *
 * ## Export (A4)
 * Render at the preset's full resolution, encode WebP at high quality (never
 * below 0.5), validate against the upload byte budget, then hand the Blob to
 * `uploadMedia` — the exact pipeline the product form uses. Returns the final
 * server URL to the caller so it can attach to a listing or a Living Picture.
 */

import * as React from 'react';
import {
  Camera,
  Check,
  Contrast,
  Crop,
  Download,
  ImagePlus,
  Loader2,
  Moon,
  Redo2,
  RotateCw,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Undo2,
  X,
  FlipHorizontal2,
  DollarSign,
  Square,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { uploadMedia } from '@/lib/media/upload-client';
import { cn } from '@/lib/utils';
import {
  CANVAS_PRESETS,
  DEFAULT_EXPORT,
  IDENTITY_ADJUSTMENTS,
  IDENTITY_FLIP,
  LOOK_PRESETS,
  type Adjustments,
  type CropRect,
  type ExportFormat,
  type FlipState,
  type Overlay,
  type OverlayKind,
  type RotateQuarter,
  normalizeExport,
  withinExportBudget,
} from '@/lib/studio/types';
import { renderStudio, canvasToBlob, extensionFor } from '@/lib/studio/render';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface StudioState {
  presetId: string;
  adjustments: Adjustments;
  crop: CropRect;
  rotate: RotateQuarter;
  flip: FlipState;
  overlays: Overlay[];
}

interface SourceImage {
  /** Object URL for the loaded photo (revoked on replace). */
  url: string;
  width: number;
  height: number;
  /** The original File, kept so a preset change can re-crop from full source. */
  file: File;
}

const initialState = (w: number, h: number): StudioState => ({
  presetId: 'square',
  adjustments: { ...IDENTITY_ADJUSTMENTS },
  crop: { x: 0, y: 0, width: w, height: h },
  rotate: 0,
  flip: { ...IDENTITY_FLIP },
  overlays: [],
});

const MAX_HISTORY = 40;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface ClassicStudioResult {
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export function ClassicStudio({
  onSaved,
  autoPublishHint,
}: {
  /** Called once the edited image is stored on the server. */
  onSaved?: (result: ClassicStudioResult) => void;
  autoPublishHint?: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();

  const [source, setSource] = React.useState<SourceImage | null>(null);
  const [state, setState] = React.useState<StudioState | null>(null);
  const [selectedOverlay, setSelectedOverlay] = React.useState<string | null>(null);

  const [history, setHistory] = React.useState<StudioState[]>([]);
  const [future, setFuture] = React.useState<StudioState[]>([]);

  const [isExporting, setIsExporting] = React.useState(false);
  const [isComparing, setIsComparing] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>(DEFAULT_EXPORT.format);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewBoxRef = React.useRef<HTMLDivElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const previewUrlRef = React.useRef<string | null>(null);
  const imgElRef = React.useRef<HTMLImageElement | null>(null);

  /* -- history ---------------------------------------------------- */

  const commit = React.useCallback((next: StudioState) => {
    setState((prev) => {
      if (!prev) return next;
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const patch = React.useCallback(
    (partial: Partial<StudioState>) => {
      setState((prev) => (prev ? { ...prev, ...partial } : prev));
      // Dragging sliders should coalesce into one undo step, so a slider
      // change updates state directly (no commit) and the slider's
      // onPointerUp finalises it into history.
    },
    [],
  );

  const finalizeDrag = React.useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
      setFuture([]);
      return prev;
    });
  }, []);

  const undo = React.useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setState((cur) => {
        if (cur) setFuture((f) => [cur, ...f].slice(0, MAX_HISTORY));
        return previous;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = React.useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setState((cur) => {
        if (cur) setHistory((h) => [...h, cur].slice(-MAX_HISTORY));
        return next;
      });
      return f.slice(1);
    });
  }, []);

  /* -- source loading --------------------------------------------- */

  const loadFile = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Not an image', description: 'Choose a JPG, PNG or WebP photo.' });
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setSource((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { url, width: img.naturalWidth, height: img.naturalHeight, file };
        });
        setState(initialState(img.naturalWidth, img.naturalHeight));
        setHistory([]);
        setFuture([]);
        setSelectedOverlay(null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast({ variant: 'destructive', title: 'Could not open photo', description: 'The file may be corrupted.' });
      };
      img.src = url;
    },
    [toast],
  );

  // Revoke the object URL on unmount.
  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (source?.url) URL.revokeObjectURL(source.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- render preview --------------------------------------------- */

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source || !state) return;
    const preset = CANVAS_PRESETS.find((p) => p.id === state.presetId) ?? CANVAS_PRESETS[0];

    // Render at full export resolution so the preview IS the export; CSS
    // scales it down to the box. dpr is irrelevant because the canvas backing
    // store is the export size by design.
    if (canvas.width !== preset.width) canvas.width = preset.width;
    if (canvas.height !== preset.height) canvas.height = preset.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgElRef.current;
    if (!img || img.src !== source.url) {
      const el = new Image();
      el.onload = () => {
        imgElRef.current = el;
        renderStudio(ctx, {
          image: el,
          sourceWidth: source.width,
          sourceHeight: source.height,
          presetId: state.presetId,
          adjustments: state.adjustments,
          crop: state.crop,
          rotate: state.rotate,
          flip: state.flip,
          overlays: isComparing ? [] : state.overlays,
        });
      };
      el.src = source.url;
      return;
    }

    renderStudio(ctx, {
      image: img,
      sourceWidth: source.width,
      sourceHeight: source.height,
      presetId: state.presetId,
      adjustments: state.adjustments,
      crop: state.crop,
      rotate: state.rotate,
      flip: state.flip,
      overlays: isComparing ? [] : state.overlays,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, state, isComparing]);

  /* -- overlay dragging on the canvas ------------------------------ */

  const onCanvasPointer = React.useCallback(
    (clientX: number, clientY: number, phase: 'start' | 'move' | 'end') => {
      const canvas = canvasRef.current;
      const box = previewBoxRef.current;
      if (!canvas || !box || !state) return;
      const rect = box.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      if (phase === 'end') {
        finalizeDrag();
        return;
      }
      if (!selectedOverlay) return;
      setState((prev) =>
        prev
          ? {
              ...prev,
              overlays: prev.overlays.map((o) => (o.id === selectedOverlay ? { ...o, x, y } : o)),
            }
          : prev,
      );
    },
    [state, selectedOverlay, finalizeDrag],
  );

  /* -- overlay add/remove ------------------------------------------ */

  const addOverlay = React.useCallback(
    (kind: OverlayKind) => {
      if (!state) return;
      const id = `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const base: Overlay = { id, kind, x: 0.5, y: kind === 'badge' ? 0.15 : 0.5 };
      if (kind === 'text') {
        base.text = 'Your headline';
        base.scale = 0.06;
        base.color = '#FFFFFF';
        base.background = 'rgba(0,0,0,0.45)';
      } else if (kind === 'price') {
        base.price = 1000;
        base.currency = 'KSh ';
        base.scale = 0.07;
        base.color = '#FFFFFF';
        base.background = '#16A34A';
      } else if (kind === 'badge') {
        base.text = 'SALE';
        base.scale = 0.045;
        base.color = '#FFFFFF';
        base.background = '#DC2626';
      } else {
        base.shape = 'rect';
        base.background = 'rgba(255,255,255,0.85)';
        base.radius = 0.2;
      }
      commit({ ...state, overlays: [...state.overlays, base] });
      setSelectedOverlay(id);
    },
    [state, commit],
  );

  const updateOverlay = React.useCallback(
    (id: string, partial: Partial<Overlay>) => {
      setState((prev) =>
        prev
          ? { ...prev, overlays: prev.overlays.map((o) => (o.id === id ? { ...o, ...partial } : o)) }
          : prev,
      );
    },
    [],
  );

  const removeOverlay = React.useCallback(
    (id: string) => {
      if (!state) return;
      commit({ ...state, overlays: state.overlays.filter((o) => o.id !== id) });
      setSelectedOverlay((cur) => (cur === id ? null : cur));
    },
    [state, commit],
  );

  /* -- apply a look ------------------------------------------------- */

  const applyLook = React.useCallback(
    (lookId: string) => {
      if (!state) return;
      const look = LOOK_PRESETS.find((l) => l.id === lookId);
      if (!look) return;
      commit({ ...state, adjustments: { ...look.adjustments } });
    },
    [state, commit],
  );

  const resetAll = React.useCallback(() => {
    if (!source || !state) return;
    commit(initialState(source.width, source.height));
    setSelectedOverlay(null);
  }, [source, state, commit]);

  /* -- export + upload ---------------------------------------------- */

  const handleExport = React.useCallback(async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in to save', description: 'You need to be signed in to keep your edit.' });
      return;
    }
    if (!source || !state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    try {
      const opts = normalizeExport({ ...DEFAULT_EXPORT, format: exportFormat });
      let blob = await canvasToBlob(canvas, opts.format, opts.quality);
      // Fall back to JPEG if the encoder could not produce the requested type.
      if (!blob && opts.format !== 'image/jpeg') {
        blob = await canvasToBlob(canvas, 'image/jpeg', opts.quality);
      }
      if (!blob) throw new Error('This browser could not encode the image.');

      // Validate size before the round-trip so the seller gets an instant,
      // honest message instead of a server rejection.
      const budgetBytes = 10 * 1024 * 1024; // mirrors MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB
      if (!withinExportBudget(blob.size, budgetBytes)) {
        throw new Error('The edited image is over 10MB. Try a smaller canvas or JPEG format.');
      }

      const ext = extensionFor(blob.type || opts.format);
      const file = new File([blob], `vidnov-studio-${Date.now()}.${ext}`, {
        type: blob.type || opts.format,
      });

      const handle = uploadMedia(file, user);
      const result = await handle.promise;
      if (result.phase === 'failed' || !result.url) {
        throw new Error(result.error || 'Upload failed.');
      }

      toast({ title: 'Saved', description: 'Your edited photo is stored. The original is untouched.' });
      onSaved?.({
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        width: canvas.width,
        height: canvas.height,
        format: blob.type || opts.format,
        bytes: blob.size,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      toast({ variant: 'destructive', title: 'Could not save', description: message });
    } finally {
      setIsExporting(false);
    }
  }, [user, source, state, exportFormat, onSaved, toast]);

  const downloadDraft = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas, exportFormat, DEFAULT_EXPORT.quality);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidnov-edit.${extensionFor(exportFormat)}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportFormat]);

  /* -- render -------------------------------------------------------- */

  const active = selectedOverlay
    ? state?.overlays.find((o) => o.id === selectedOverlay) ?? null
    : null;
  const activePreset =
    CANVAS_PRESETS.find((p) => p.id === state?.presetId) ?? CANVAS_PRESETS[0];

  if (!source || !state) {
    return (
      <StudioImport onPick={loadFile} galleryRef={galleryInputRef} cameraRef={cameraInputRef} />
    );
  }

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div
        ref={previewBoxRef}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-black/90 touch-none select-none"
        style={{
          // The preview box takes the PRESET's shape so arranging a design on a
          // portrait or story canvas is not shown inside a square box (the
          // export was always correct; this keeps the on-screen arrangement
          // honest too). Falls back to square if the preset is unknown.
          aspectRatio: `${activePreset.width} / ${activePreset.height}`,
        }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          onCanvasPointer(e.clientX, e.clientY, 'start');
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) onCanvasPointer(e.clientX, e.clientY, 'move');
        }}
        onPointerUp={(e) => onCanvasPointer(e.clientX, e.clientY, 'end')}
      >
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
        {isComparing && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Original
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ToolButton icon={Undo2} label="Undo" onClick={undo} disabled={history.length === 0} />
        <ToolButton icon={Redo2} label="Redo" onClick={redo} disabled={future.length === 0} />
        <ToolButton
          icon={RefreshCw}
          label="Reset"
          onClick={resetAll}
        />
        <ToolButton
          icon={Sparkles}
          label="Compare"
          active={isComparing}
          onPointerDown={() => setIsComparing(true)}
          onPointerUp={() => setIsComparing(false)}
          onPointerLeave={() => setIsComparing(false)}
        />
        <ToolButton icon={Camera} label="Replace" onClick={() => galleryInputRef.current?.click()} />
        <ToolButton icon={Trash2} label="Remove" onClick={() => { setSource(null); setState(null); }} />
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = '';
        }}
      />

      <Tabs defaultValue="adjust">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="adjust">Adjust</TabsTrigger>
          <TabsTrigger value="crop">Crop</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* ADJUST */}
        <TabsContent value="adjust" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LOOK_PRESETS.map((look) => (
              <button
                key={look.id}
                type="button"
                onClick={() => applyLook(look.id)}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary"
              >
                {look.label}
              </button>
            ))}
          </div>
          <AdjustSlider icon={Sun} label="Brightness" value={state.adjustments.brightness}
            onChange={(v) => patch({ adjustments: { ...state.adjustments, brightness: v } })}
            onCommit={finalizeDrag} />
          <AdjustSlider icon={Contrast} label="Contrast" value={state.adjustments.contrast}
            onChange={(v) => patch({ adjustments: { ...state.adjustments, contrast: v } })}
            onCommit={finalizeDrag} />
          <AdjustSlider icon={Sparkles} label="Saturation" value={state.adjustments.saturation}
            onChange={(v) => patch({ adjustments: { ...state.adjustments, saturation: v } })}
            onCommit={finalizeDrag} />
          <AdjustSlider icon={Moon} label="Warmth" value={state.adjustments.warmth}
            onChange={(v) => patch({ adjustments: { ...state.adjustments, warmth: v } })}
            onCommit={finalizeDrag} />
        </TabsContent>

        {/* CROP */}
        <TabsContent value="crop" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CANVAS_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => commit({ ...state, presetId: p.id })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                  state.presetId === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                )}
              >
                {p.label} · {p.width}×{p.height}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <ToolButton icon={RotateCw} label="Rotate 90°"
              onClick={() => commit({ ...state, rotate: (((state.rotate + 90) % 360) as RotateQuarter) })} />
            <ToolButton icon={FlipHorizontal2} label="Flip H"
              onClick={() => commit({ ...state, flip: { ...state.flip, horizontal: !state.flip.horizontal } })} />
            <ToolButton icon={RefreshCw} label="Flip V"
              onClick={() => commit({ ...state, flip: { ...state.flip, vertical: !state.flip.vertical } })} />
            <ToolButton icon={Crop} label="Trim to canvas"
              onClick={() => commit({ ...state, crop: { x: 0, y: 0, width: source.width, height: source.height } })} />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            The photo is fitted to the canvas keeping its shape. Pick a preset for the output shape.
          </p>
        </TabsContent>

        {/* DESIGN */}
        <TabsContent value="design" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <AddOverlayButton icon={Type} label="Text" onClick={() => addOverlay('text')} />
            <AddOverlayButton icon={DollarSign} label="Price" onClick={() => addOverlay('price')} />
            <AddOverlayButton icon={Check} label="Badge" onClick={() => addOverlay('badge')} />
            <AddOverlayButton icon={Square} label="Shape" onClick={() => addOverlay('shape')} />
          </div>

          {state.overlays.length > 0 && (
            <div className="space-y-2">
              {state.overlays.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOverlay(o.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px]',
                    selectedOverlay === o.id ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <span className="truncate">{overlayLabel(o)}</span>
                  <X className="h-3.5 w-3.5" onClick={(e) => { e.stopPropagation(); removeOverlay(o.id); }} />
                </button>
              ))}
            </div>
          )}

          {active && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              {(active.kind === 'text' || active.kind === 'badge') && (
                <div className="space-y-1">
                  <Label>Text</Label>
                  <Input value={active.text ?? ''} onChange={(e) => updateOverlay(active.id, { text: e.target.value })} />
                </div>
              )}
              {active.kind === 'price' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Price</Label>
                    <Input type="number" value={active.price ?? 0}
                      onChange={(e) => updateOverlay(active.id, { price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Was (optional)</Label>
                    <Input type="number" value={active.wasPrice ?? ''}
                      onChange={(e) => updateOverlay(active.id, { wasPrice: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label>Size</Label>
                <Slider min={0.02} max={0.16} step={0.005} value={[active.scale ?? 0.05]}
                  onValueChange={([v]) => updateOverlay(active.id, { scale: v })} />
              </div>
              <div className="flex items-center gap-2">
                <Label>Colour</Label>
                <input type="color" value={toHex(active.color || '#ffffff')}
                  onChange={(e) => updateOverlay(active.id, { color: e.target.value })} className="h-8 w-10 rounded border border-border" />
                <Label className="ml-2">Background</Label>
                <input type="color" value={toHex(active.background || '#000000')}
                  onChange={(e) => updateOverlay(active.id, { background: e.target.value })} className="h-8 w-10 rounded border border-border" />
              </div>
              <p className="text-[10px] text-muted-foreground">Drag the element on the canvas to position it.</p>
            </div>
          )}
        </TabsContent>

        {/* EXPORT */}
        <TabsContent value="export" className="space-y-4">
          <div className="flex gap-2">
            {(['image/webp', 'image/jpeg'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setExportFormat(f)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                  exportFormat === f ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                )}
              >
                {f === 'image/webp' ? 'WebP (best)' : 'JPG (smallest)'}
              </button>
            ))}
          </div>
          {autoPublishHint && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] text-primary">{autoPublishHint}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleExport} disabled={isExporting} className="flex-1">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Saving…' : 'Save to studio'}
            </Button>
            <Button variant="outline" onClick={downloadDraft} disabled={isExporting}>
              Download
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saves a NEW edited photo. Your original upload is kept exactly as it is.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StudioImport({
  onPick,
  galleryRef,
  cameraRef,
}: {
  onPick: (f: File) => void;
  galleryRef: React.RefObject<HTMLInputElement | null>;
  cameraRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">Start with a photo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload from your gallery, or open the camera to shoot a fresh product photo.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" /> Gallery
          </Button>
          <Button variant="outline" onClick={() => cameraRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> Camera
          </Button>
        </div>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
      {/* `capture` hints the rear camera on a capable device; elsewhere the
          browser simply opens the file picker — the gallery fallback. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={cn(
        'flex h-11 w-11 flex-col items-center justify-center rounded-xl border text-[8px] font-bold uppercase tracking-wider',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
        disabled && 'opacity-40',
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function AdjustSlider({
  icon: Icon,
  label,
  value,
  onChange,
  onCommit,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
        <span className="ml-auto tabular-nums">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={-1}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

function AddOverlayButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function overlayLabel(o: Overlay): string {
  if (o.kind === 'price') return `Price ${o.currency ?? ''}${o.price ?? 0}`;
  if (o.kind === 'shape') return 'Shape';
  return o.text || o.kind;
}

function toHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#000000';
}
