# VIDNOV Design System — One Brand, Platform-Native Layouts

> Rule: **the brand never changes; the layout adapts to the platform.**
> Web uses sidebars and wide grids. The app uses bottom tabs and full-bleed
> feeds. Both pull from the tokens below so everything feels like Vidnov.

## 1. Brand colors (never change)

| Token | Value | Use |
| --- | --- | --- |
| `--primary` (coral) | `#FF4D2E` | CTAs, live badges, active states |
| `coral-soft` | `#FF7A5C` | Gradient pair for coral |
| `ember-navy` | `#0A1224` | App canvas, dark sections |
| `ember-cyan` | `#22D3EE` | Data, real-time accents |
| `ember-violet` | `#8B5CF6` | AI features |
| `lime` | `#C8FF00` | Highlights (sparing) |

**Gradients:** `vn-grad-coral` `#FF4D2E→#FF7A45` · `vn-grad-ocean` · `vn-grad-violet` · `vn-grad-ember` (defined in globals.css)

## 2. Type

| Role | Font | Classes |
| --- | --- | --- |
| Display / headings | Space Grotesk | `font-grotesk` + `vn-display` |
| Body | Inter | default |
| Micro-labels | Inter | `text-[10px] font-bold uppercase tracking-[0.2em]` |

## 3. Shape, space, motion

- Radius: cards `rounded-2xl`, buttons `rounded-xl`, chips `rounded-full`
- Card shadow: `vn-shadow`; glow on primary CTAs: `vn-shadow-glow`
- Motion: `vn-transition` (200ms), float loops `vn-float`, page enter `vn-page-enter`
- Status dots: `vn-dot-active` (live), `vn-dot-processing`, `vn-dot-pending`

## 4. Platform rules

| Surface | Navigation | Density | Images |
| --- | --- | --- | --- |
| Web (desktop) | Left sidebar (buyer/seller/admin) + top header | Wide grids, 2-col forms | Gallery walls, 16:9 cards |
| Web (mobile browser) | Collapsible sheet sidebar | Single column | Same cards, stacked |
| App (iOS/Android) | **Bottom tab bar** — Home · Requests · Create · Cart · Account | Full-bleed, thumb-sized targets | 4:5 feed tiles, full-screen live |

Reference implementation of the app shell: `/app-preview`.
Media library with folders + save-to-phone: `/buyer/media`.

## 5. Voice & microcopy

- Headings: short, bold, UPPER — "Sell the future of commerce."
- Buttons: verb-first — "Start a Business", "Shop live", "Post Request"
- Numbers with momentum: "+24% vs last week", "1,204 watching now"
