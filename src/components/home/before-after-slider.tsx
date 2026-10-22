'use client';

import * as React from 'react';

/**
 * BEFORE / AFTER SLIDER — the Transformation Lab's centrepiece.
 *
 * Pure CSS clip + a native range input, so it is keyboard-accessible out of
 * the box (arrows step the comparison) and needs no animation library. Both
 * panels are the site's own demo artwork, labelled as such by the section —
 * this slider never implies real AI processing ran on a visitor's photo; the
 * CTA under it points at the real editor.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = 'Original',
  afterLabel = 'Enhanced',
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragging = React.useRef(false);

  const updateFromPointer = React.useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    setPosition(Math.min(100, Math.max(0, Math.round(ratio * 100))));
  }, [containerRef]);

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      updateFromPointer(event.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [updateFromPointer]);

  return (
    <div className="select-none">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border-2 border-[#171717] shadow-[6px_6px_0_0_rgba(23,23,23,0.9)]"
        onPointerDown={(event) => {
          dragging.current = true;
          updateFromPointer(event.clientX);
        }}
      >
        {/* After layer fills the frame; before layer is clipped by position. */}
        <div className="block">{after}</div>
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {before}
        </div>

        {/* The handle line */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#F5F0E6]"
          style={{ left: `calc(${position}% - 1px)` }}
          aria-hidden
        >
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#171717] bg-[#FF4D36] text-[#F5F0E6]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M9 6 L4 12 L9 18 M15 6 L20 12 L15 18" />
            </svg>
          </span>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#171717] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F0E6]">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[#344DE8] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F0E6]">
          {afterLabel}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Drag to compare the original and enhanced versions</span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="h-2 w-full cursor-ew-resize appearance-none rounded-full bg-[#171717]/15 accent-[#FF4D36]"
          aria-label="Compare original and enhanced versions"
        />
      </label>
    </div>
  );
}
