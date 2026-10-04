import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * VIDNOV LOGO.
 *
 * Brand name is styled "Vidnov" — mixed case, never VIDNOV. Uppercase reads as
 * a shout in a wordmark; mixed case reads as a product name, and it is what the
 * company is called everywhere else.
 *
 * ── The mark ────────────────────────────────────────────────────────────────
 * A bold "V" built from two tapered strokes that meet at a point. The concept is
 * unchanged from the original mark — V for Vidnov — but the geometry is redrawn
 * for a professional finish:
 *
 *  • Strokes taper as they descend (wider at the shoulder, tighter at the
 *    point), which reads as forward motion and suggests a play/forward gesture.
 *  • The apex is a true point rather than a flat cut, so the mark stays sharp
 *    at small sizes (app icon, favicon) instead of turning into a blob.
 *  • The inner counter is a clean chevron notch, cut with a <mask> so it is
 *    genuine negative space rather than a shape painted in the page background.
 *
 * ── Why the notch is masked, not painted ────────────────────────────────────
 * It used to be a polygon filled with `var(--background)`. That is only correct
 * when the logo sits directly on the page background. On a card, a modal, an
 * invoice header or any elevated surface the notch filled with the *page* colour
 * and read as a stray chip sitting on top of the mark. A mask makes the notch
 * transparent everywhere, so the mark needs no knowledge of what is behind it.
 *
 * ── Why the wordmark is text, not paths ─────────────────────────────────────
 * The wordmark was previously hand-drawn as SVG paths. Three separate attempts at
 * hand-built glyph geometry all failed in the same way: counters had to be cut by
 * painting over them (same background-colour problem as the notch above), and the
 * letters were spaced tightly enough that adjacent stems touched — the "d" and "o"
 * bowls fused with their neighbours and the lockup read as "VianoV". At real UI
 * sizes the damage was not subtle.
 *
 * Rendering the wordmark as a real text node in the brand typeface is both
 * simpler and more correct. It cannot self-intersect, it stays sharp at every size,
 * it is selectable and searchable, it respects the user's font settings, and it
 * gets proper letter-spacing and kerning for free. The brand icons
 * (`scripts/generate-brand-icons.ts`) are generated from the V mark alone, so
 * nothing that ships as a raster asset depends on the wordmark being paths.
 *
 * ── Colour ──────────────────────────────────────────────────────────────────
 *  • Mono contexts (headers, dark chrome, print): `currentColor`, so it adapts
 *    to light and dark themes with no prop plumbing.
 *  • Full colour (`color`/`accentColor`): coral → cyan across the two strokes,
 *    the existing Vidnov identity.
 */

interface VidnovLogoProps {
  className?: string;
  /** Fill of the left stroke. Defaults to currentColor. */
  color?: string;
  /** Fill of the right stroke. Defaults to the left color. */
  accentColor?: string | null;
  'aria-label'?: string;
}

/**
 * The V mark's geometry, in a 100×100 design space.
 *
 *  • Left stroke  : 12,8 → 38,8 → 58,92 → 30,92   (tapers toward the apex)
 *  • Right stroke : 62,8 → 88,8 → 70,92 → 42,92
 *  • Notch (cut)  : 41,30 → 59,30 → 54,72 → 41,72
 *
 * Exported so `scripts/generate-brand-icons.ts` and any future icon work stay in
 * step with the component instead of re-deriving the numbers.
 */
export const V_MARK = {
  left: '12,8 38,8 58,92 30,92',
  right: '62,8 88,8 70,92 42,92',
  notch: '41,30 59,30 54,72 41,72',
} as const;

/** Raw "V" mark in a 100×100 design space. */
export function VidnovLogo({
  className = 'w-10 h-10',
  color = 'currentColor',
  accentColor = null,
  ...rest
}: VidnovLogoProps) {
  const maskId = React.useId();

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      {...rest}
    >
      <mask id={maskId}>
        {/* White = keep, black = cut. */}
        <rect width="100" height="100" fill="white" />
        <polygon points={V_MARK.notch} fill="black" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <polygon points={V_MARK.left} fill={color} />
        <polygon points={V_MARK.right} fill={accentColor || color} />
      </g>
    </svg>
  );
}

/**
 * Full lockup — mark + "Vidnov" wordmark.
 *
 * Sized by font size, so the whole lockup scales as one unit:
 *
 *     <Logo className="text-2xl" />
 *
 * The mark is sized in `em` against the wordmark's own size, which keeps the
 * mark-to-type ratio constant at every step of the type scale.
 */
export const Logo = ({
  className,
  withTagline = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { withTagline?: boolean }) => {
  const maskId = React.useId();

  return (
    <span
      className={cn('inline-flex items-center gap-[0.28em] text-foreground', className)}
      {...props}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        className="h-[1.06em] w-[1.06em] shrink-0 overflow-visible"
      >
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <polygon points={V_MARK.notch} fill="black" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <polygon points={V_MARK.left} fill="currentColor" />
          <polygon points={V_MARK.right} fill="currentColor" />
        </g>
      </svg>

      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span
          className="font-grotesk text-[1em] font-bold tracking-[-0.035em]"
          aria-label="Vidnov"
        >
          Vidnov
        </span>
        {withTagline && (
          <span className="mt-[0.42em] font-sora text-[0.245em] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Post · Earn · Repeat
          </span>
        )}
      </span>
    </span>
  );
};

/**
 * Standalone "V" mark — the app-icon form. Uses the brand gradients by default.
 */
export const LogoMark = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => {
  const maskId = React.useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn(className)}
      role="img"
      aria-label="Vidnov"
      {...props}
    >
      <defs>
        <linearGradient id="vnMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF4D2E" />
          <stop offset="100%" stopColor="#FF7A45" />
        </linearGradient>
        <linearGradient id="vnMarkGradB" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <mask id={maskId}>
        <rect width="100" height="100" fill="white" />
        <polygon points={V_MARK.notch} fill="black" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <polygon points={V_MARK.left} fill="url(#vnMarkGrad)" />
        <polygon points={V_MARK.right} fill="url(#vnMarkGradB)" />
      </g>
    </svg>
  );
};

/**
 * App icon tile — the "V" mark on an ember-navy rounded tile. This is the
 * identity used for PWA icons and anywhere a fixed, self-contained badge is
 * needed.
 */
export const LogoTile = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => {
  const maskId = React.useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn(className)}
      role="img"
      aria-label="Vidnov app"
      {...props}
    >
      <defs>
        <linearGradient id="vnTileGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF4D2E" />
          <stop offset="100%" stopColor="#FF7A45" />
        </linearGradient>
        <linearGradient id="vnTileGradB" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="#0A1224" />
      {/* Mark inset and scaled for the tile (safe area ~14%). The notch is cut,
          so the tile colour shows through it. */}
      <g transform="translate(24,24) scale(0.52)">
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <polygon points={V_MARK.notch} fill="black" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <polygon points={V_MARK.left} fill="url(#vnTileGrad)" />
          <polygon points={V_MARK.right} fill="url(#vnTileGradB)" />
        </g>
      </g>
    </svg>
  );
};
