/**
 * Generates the Vidnov brand icons from the logo geometry.
 *
 * Run: npx tsx scripts/generate-brand-icons.ts
 *
 * The SVG below is the same geometry as `src/components/logo.tsx`, so the
 * installed app icon and the in-app logo are the same drawing rather than two
 * hand-maintained copies that drift.
 *
 * Maskable icons get extra padding because Android crops them to a circle,
 * and the mark must survive that crop (the safe zone is the middle 80%).
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'public', 'icons');
const EMBER_NAVY = '#0A1224';

mkdirSync(OUT_DIR, { recursive: true });

/** The mark, in a 100×100 design space. */
const mark = (inset: number, scale: number, notch: string) => `
  <g transform="translate(${inset},${inset}) scale(${scale})">
    <polygon points="12,8 38,8 58,92 30,92" fill="url(#gA)"/>
    <polygon points="62,8 88,8 70,92 42,92" fill="url(#gB)"/>
    <polygon points="41,30 59,30 54,72 41,72" fill="${notch}"/>
  </g>`;

const defs = `
  <defs>
    <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF4D2E"/>
      <stop offset="100%" stop-color="#FF7A45"/>
    </linearGradient>
    <linearGradient id="gB" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
  </defs>`;

/**
 * Full-bleed tile, no corner radius.
 *
 * Deliberate: the launcher applies its OWN shape (circle on Pixel, squircle on
 * iOS, teardrop on some OEMs). Pre-rounding the icon here would make the
 * launcher round an already-round corner and leave a transparent fringe, so
 * "any purpose" icons ship square and full-bleed.
 */
const tile = (inset: number, scale: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs}
  <rect width="512" height="512" fill="${EMBER_NAVY}"/>
  <g transform="scale(5.12)">${mark(inset, scale, EMBER_NAVY)}</g>
</svg>`;

/**
 * Maskable: the launcher crops hard (a circle can lose 25% of the width), so
 * the mark is inset further to stay inside the guaranteed-safe centre circle.
 */
const maskable = (inset: number, scale: number) => tile(inset, scale);

const targets: Array<{ file: string; size: number; svg: string }> = [
  { file: 'icon-192.png', size: 192, svg: tile(24, 0.52) },
  { file: 'icon-512.png', size: 512, svg: tile(24, 0.52) },
  { file: 'icon-maskable-512.png', size: 512, svg: maskable(30, 0.4) },
  { file: 'apple-touch-icon.png', size: 180, svg: tile(24, 0.52) },
  { file: 'favicon-32.png', size: 32, svg: tile(24, 0.52) },
  { file: 'favicon-64.png', size: 64, svg: tile(24, 0.52) },
];

async function main() {
  for (const t of targets) {
    const png = await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toBuffer();
    await sharp(png).toFile(join(OUT_DIR, t.file));
    console.log(`wrote ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
  }

  // favicon.ico: a PNG embedded in an ICO container. Every browser that still
  // asks for /favicon.ico understands this form.
  const png = await sharp(Buffer.from(tile(24, 0.52))).resize(32, 32).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32BE(png.length, 14); // data size
  header.writeUInt32LE(22, 18); // data offset
  const ico = Buffer.concat([header, png]);
  require('fs').writeFileSync(join(process.cwd(), 'public', 'favicon.ico'), ico);
  console.log(`wrote favicon.ico (${ico.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});