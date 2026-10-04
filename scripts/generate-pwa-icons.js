/**
 * Generates the VIDNOV PWA icon PNGs from the flat geometric V mark.
 * Geometry matches src/components/logo.tsx (100×100 user concept):
 *   left 10,10 42,10 65,90 33,90 · right 53,10 85,10 100,90 68,90
 *   notch 38,26 56,26 51,74 33,74 (painted the tile color).
 * Dark tiles carry the brand gradient (coral→orange left, sky→cyan right);
 * the Apple icon keeps near-black art on white.
 * Run: node scripts/generate-pwa-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function renderPng(size, pixelFn) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ===== V geometry — 100×100 design space, matches logo.tsx =====
const POLY_LEFT = [[10, 10], [42, 10], [65, 90], [33, 90]];
const POLY_RIGHT = [[53, 10], [85, 10], [100, 90], [68, 90]];
const POLY_NOTCH = [[38, 26], [56, 26], [51, 74], [33, 74]];

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const DARK_BG = [10, 18, 36];      // #0A1224 ember navy
const LIGHT_BG = [255, 255, 255];  // #FFFFFF
const WHITE = [255, 255, 255];
const NAVY = [10, 18, 36];

function makePixelFn(size, variant) {
  const maskable = variant === 'maskable';
  const pad = maskable ? 0.30 : 0.18;
  // The mark spans x 10..100, y 10..90 → center x=55, so pad box 0..110 wide.
  const s = (size * (1 - pad * 2)) / 110;
  const ox = size * pad + size * (1 - pad * 2) * (5 / 110);
  const oy = size * pad - 10 * s;

  return (x, y) => {
    const dx = (x - ox) / s;
    const dy = (y - oy) / s;
    const bg = variant === 'light' ? LIGHT_BG : DARK_BG;
    const stroke = variant === 'light' ? NAVY : WHITE;

    // Brand gradient across the mark: coral→orange on the left stroke,
    // sky→cyan on the right (matches src/components/logo.tsx gradients).
    // t goes 0→1 diagonally across the icon box.
    const t = Math.min(1, Math.max(0, (dx + dy) / 2));
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    const coralA = [255, 77, 46], coralB = [255, 122, 69];
    const skyA = [14, 165, 233], skyB = [34, 211, 238];

    if (pointInPoly(dx, dy, POLY_LEFT)) {
      if (variant === 'light') return [...NAVY, 255];
      return [lerp(coralA[0], coralB[0]), lerp(coralA[1], coralB[1]), lerp(coralA[2], coralB[2]), 255];
    }
    if (pointInPoly(dx, dy, POLY_RIGHT)) {
      if (variant === 'light') return [...NAVY, 255];
      return [lerp(skyA[0], skyB[0]), lerp(skyA[1], skyB[1]), lerp(skyA[2], skyB[2]), 255];
    }
    if (pointInPoly(dx, dy, POLY_NOTCH)) return [...bg, 255];
    return [...bg, 255];
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, variant: 'dark' },
  { file: 'icon-512.png', size: 512, variant: 'dark' },
  { file: 'icon-maskable-512.png', size: 512, variant: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, variant: 'light' },
];

for (const t of targets) {
  const buf = renderPng(t.size, makePixelFn(t.size, t.variant));
  fs.writeFileSync(path.join(OUT_DIR, t.file), buf);
  console.log('wrote', t.file, buf.length, 'bytes');
}
