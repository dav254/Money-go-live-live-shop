'use client';

import * as React from 'react';

/**
 * VIDNOV PLAYGROUND — visual system.
 *
 * The homepage shows NO real seller inventory: the platform is at launch and
 * the honest thing to display is clearly-labelled demonstration content. Every
 * artwork below is an original vector illustration drawn in the Playground
 * palette — no hotlinked stock, no broken image URLs, no pretending a demo
 * product is real seller stock. The only real media on the page is the repo's
 * own demo MP4 in the Motion section, labelled as a demo.
 *
 * Fonts are the ones already loaded in globals.css: Space Grotesk (display),
 * Inter (body) and Instrument Serif (editorial accent italics).
 */

export const PLAYGROUND = {
  ivory: '#F5F0E6',
  ink: '#171717',
  coral: '#FF4D36',
  cobalt: '#344DE8',
  lime: '#D9F36A',
  gray: '#77746D',
} as const;

/* ── Paper texture ────────────────────────────────────────────────────── */

const PAPER_TEXTURE_URL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(#n)' opacity='0.05'/></svg>`,
)}")`;

export function PaperTexture() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage: PAPER_TEXTURE_URL, backgroundSize: '140px 140px' }}
    />
  );
}

/* ── Reveal-on-scroll ─────────────────────────────────────────────────── */

/**
 * Fades content up once when it first enters the viewport. Pure CSS
 * transition, IntersectionObserver only, honors prefers-reduced-motion, and
 * never hides content from users without JS (the initial state is applied
 * client-side only after mount).
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return (      <div
      ref={setRef}
      className={className}
      style={{
        opacity: visible ? 1 : undefined,
        transform: visible ? undefined : 'translateY(14px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Rotating demo stamp ──────────────────────────────────────────────── */

/** Circular rubber-stamp seal. Spins gently; stops entirely for reduced motion. */
export function StampSeal({
  text = 'DEMO EXPERIENCE · CURATED FOR VIDNOV · ',
  className = '',
  color = PLAYGROUND.ink,
  size = 108,
}: {
  text?: string;
  className?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full motion-safe:animate-[spin_22s_linear_infinite]"
        role="img"
        aria-label={text.replaceAll('·', '')}
      >
        <defs>
          <path id="stamp-circle" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="1.4" />
        <circle cx="50" cy="50" r="27.5" fill="none" stroke={color} strokeWidth="0.8" />
        <text fontSize="9.2" fontWeight="700" letterSpacing="1.6" fill={color}>
          <textPath href="#stamp-circle" startOffset="0">
            {text}
          </textPath>
        </text>
        <text
          x="50"
          y="54.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill={color}
          letterSpacing="0.5"
        >
          DEMO
        </text>
      </svg>
    </div>
  );
}

/* ── Demo artworks ────────────────────────────────────────────────────── */
/*
 * Flat, editorial vector illustrations in the Playground palette. They stand
 * in for product photography while the platform has no seller base — always
 * presented with DEMO labels so nothing here reads as real seller stock.
 */

type ArtProps = { className?: string };

export function SneakerArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a sneaker (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.cobalt} />
      <g fill="none" stroke={PLAYGROUND.ivory} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M38 96 C52 88, 64 84, 78 70 C84 64, 90 58, 100 58 C108 58, 112 64, 118 70 C128 80, 146 84, 162 88 C170 90, 174 94, 174 100 L174 106 L38 106 Z" fill={PLAYGROUND.ivory} stroke="none" />
        <path d="M38 106 h136 v6 a8 8 0 0 1 -8 8 H46 a8 8 0 0 1 -8 -8 Z" fill={PLAYGROUND.ink} stroke="none" />
        <path d="M84 72 h26 M78 82 h38 M72 92 h52" stroke={PLAYGROUND.cobalt} strokeWidth="5" />
        <path d="M100 58 C96 66, 96 76, 100 92" stroke={PLAYGROUND.cobalt} strokeWidth="4" />
        <circle cx="150" cy="96" r="4.5" fill={PLAYGROUND.coral} stroke="none" />
      </g>
      <path d="M20 30 q10 -10 20 0 q10 10 20 0" stroke={PLAYGROUND.lime} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function HeadphonesArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of headphones (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.ink} />
      <path d="M60 96 V78 a40 40 0 0 1 80 0 v18" fill="none" stroke={PLAYGROUND.ivory} strokeWidth="7" strokeLinecap="round" />
      <rect x="46" y="90" width="24" height="38" rx="11" fill={PLAYGROUND.coral} />
      <rect x="130" y="90" width="24" height="38" rx="11" fill={PLAYGROUND.lime} />
      <circle cx="100" cy="34" r="5" fill={PLAYGROUND.cobalt} />
      <path d="M28 128 h144" stroke={PLAYGROUND.gray} strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
    </svg>
  );
}

export function CoffeeBagArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a coffee bag (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.ivory} />
      <path d="M70 40 h60 l6 12 v78 a6 6 0 0 1 -6 6 H70 a6 6 0 0 1 -6 -6 V52 Z" fill={PLAYGROUND.coral} />
      <path d="M64 52 h72" stroke={PLAYGROUND.ink} strokeWidth="3" />
      <rect x="78" y="70" width="44" height="44" rx="4" fill={PLAYGROUND.ivory} />
      <circle cx="100" cy="88" r="9" fill="none" stroke={PLAYGROUND.ink} strokeWidth="3" />
      <path d="M100 79 v18 M91 88 h18" stroke={PLAYGROUND.ink} strokeWidth="2.5" />
      <text x="100" y="107" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={PLAYGROUND.ink} letterSpacing="1.2">DEMO ROAST</text>
      <path d="M88 30 q4 -8 12 -8 M104 28 q5 -6 11 -4" stroke={PLAYGROUND.gray} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SkincareArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a skincare bottle (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.lime} />
      <rect x="82" y="26" width="36" height="14" rx="3" fill={PLAYGROUND.ink} />
      <rect x="88" y="40" width="24" height="12" rx="2" fill={PLAYGROUND.gray} />
      <rect x="72" y="52" width="56" height="72" rx="10" fill={PLAYGROUND.ivory} stroke={PLAYGROUND.ink} strokeWidth="2.5" />
      <circle cx="100" cy="80" r="12" fill="none" stroke={PLAYGROUND.coral} strokeWidth="3" />
      <path d="M100 68 v24 M88 80 h24" stroke={PLAYGROUND.coral} strokeWidth="2" />
      <text x="100" y="112" textAnchor="middle" fontSize="7" fontWeight="700" fill={PLAYGROUND.ink} letterSpacing="1">DEMO CARE</text>
      <circle cx="46" cy="112" r="10" fill={PLAYGROUND.cobalt} />
      <circle cx="156" cy="40" r="7" fill={PLAYGROUND.coral} />
    </svg>
  );
}

export function WatchArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a wristwatch (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.coral} />
      <rect x="88" y="14" width="24" height="30" rx="6" fill={PLAYGROUND.ink} />
      <rect x="88" y="106" width="24" height="30" rx="6" fill={PLAYGROUND.ink} />
      <circle cx="100" cy="75" r="36" fill={PLAYGROUND.ivory} stroke={PLAYGROUND.ink} strokeWidth="3" />
      <circle cx="100" cy="75" r="28" fill="none" stroke={PLAYGROUND.gray} strokeWidth="1.5" />
      <path d="M100 75 V56 M100 75 l14 9" stroke={PLAYGROUND.ink} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="100" cy="75" r="3.5" fill={PLAYGROUND.cobalt} />
    </svg>
  );
}

export function LampArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a table lamp (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.cobalt} />
      <path d="M74 34 h52 l14 38 H60 Z" fill={PLAYGROUND.lime} stroke={PLAYGROUND.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="96" y="72" width="8" height="44" fill={PLAYGROUND.ivory} />
      <rect x="72" y="116" width="56" height="10" rx="5" fill={PLAYGROUND.ink} />
      <circle cx="100" cy="60" r="6" fill={PLAYGROUND.coral} />
      <path d="M34 128 h132" stroke={PLAYGROUND.ivory} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
    </svg>
  );
}

export function ToteArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Illustration of a tote bag (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.ivory} />
      <path d="M62 50 h76 l8 76 H54 Z" fill={PLAYGROUND.ink} />
      <path d="M80 50 v-8 a20 20 0 0 1 40 0 v8" fill="none" stroke={PLAYGROUND.coral} strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="92" r="16" fill="none" stroke={PLAYGROUND.lime} strokeWidth="4" />
      <path d="M100 76 v32 M84 92 h32" stroke={PLAYGROUND.lime} strokeWidth="2.5" />
    </svg>
  );
}

/** Typographic promo poster — fictional brand, no real commercial claims. */
export function PosterArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 200 260" className={className} role="img" aria-label="Illustration of a promotional poster with a fictional demo brand">
      <rect width="200" height="260" fill={PLAYGROUND.coral} />
      <text x="18" y="52" fontSize="34" fontWeight="800" fill={PLAYGROUND.ivory} letterSpacing="-0.5">MOVE</text>
      <text x="18" y="90" fontSize="34" fontWeight="800" fill={PLAYGROUND.ink} letterSpacing="-0.5">DIFFERENT</text>
      <rect x="18" y="106" width="64" height="20" rx="10" fill={PLAYGROUND.lime} />
      <text x="50" y="120" textAnchor="middle" fontSize="10" fontWeight="800" fill={PLAYGROUND.ink}>DEMO</text>
      <circle cx="138" cy="180" r="44" fill={PLAYGROUND.ink} />
      <path d="M118 188 C126 180, 132 176, 140 166 C144 162, 148 160, 152 162 C156 164, 156 170, 160 176 C164 182, 170 184, 174 186 L174 196 H116 Z" fill={PLAYGROUND.ivory} />
      <text x="18" y="236" fontSize="11" fontWeight="700" fill={PLAYGROUND.ivory} letterSpacing="1.5">PACE · FICTIONAL BRAND</text>
      <text x="18" y="251" fontSize="8.5" fill={PLAYGROUND.ivory} letterSpacing="0.5">Illustrative concept — not for sale</text>
    </svg>
  );
}

/** Video still frame with play badge (links to the real video experience). */
export function VideoStillArt({ className = '', label = 'DEMO' }: ArtProps & { label?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="Video preview still (demo)">
      <rect width="200" height="150" fill={PLAYGROUND.ink} />
      <circle cx="100" cy="70" r="26" fill={PLAYGROUND.coral} />
      <path d="M93 58 l18 12 -18 12 Z" fill={PLAYGROUND.ivory} />
      <text x="100" y="122" textAnchor="middle" fontSize="9" fontWeight="700" fill={PLAYGROUND.ivory} letterSpacing="2">{label}</text>
      <path d="M16 136 h40" stroke={PLAYGROUND.lime} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
