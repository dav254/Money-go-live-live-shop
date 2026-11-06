/**
 * VIDNOV MOBILE — design tokens.
 *
 * The Android app is its own product: these tokens mirror Vidnov's red/black
 * identity (the same values the website's landing page uses) but every value
 * is expressed for React Native, so nothing here depends on Tailwind, CSS
 * variables or the website bundle.
 */

export const colors = {
  /** Page base — near-black, not pure black (screens read better). */
  background: '#0A0A0B',
  surface: '#141416',
  surfaceRaised: '#1C1C1F',
  border: '#2A2A2E',
  /** Vidnov signal red. */
  primary: '#FF4D2E',
  primaryPressed: '#E33E22',
  primarySoft: 'rgba(255, 77, 46, 0.14)',
  text: '#F5F5F7',
  textMuted: '#9A9AA2',
  textFaint: '#6B6B73',
  success: '#2FBF71',
  warning: '#F5A524',
  danger: '#F04438',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
} as const;

/** Consistent hit target for every tappable element (Android guideline 48dp). */
export const HIT = 48;
