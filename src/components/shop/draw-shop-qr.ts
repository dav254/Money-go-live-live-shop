import QRCode from 'qrcode';

export type ShopQROptions = {
  /** Absolute storefront URL — what a scanner must open. */
  url: string;
  /** Rendered square size in CSS pixels. */
  size: number;
  /** Brand accent for the finder-eye cores. */
  accent?: string;
};

/**
 * Draws a REAL, scannable QR for the seller's storefront onto a canvas.
 *
 * ## Why this exists instead of the old pattern
 *
 * The previous drawer drew hash-noise squares that *looked* like a QR but
 * encoded nothing — a seller printing it would hand customers a sticker that
 * scans to nowhere. This encodes the actual shop URL through the `qrcode`
 * encoder (error correction Q, so a scuffed print still scans) and renders the
 * module matrix itself, which is what buys the unique look:
 *
 *   • modules are rounded dots rather than squares,
 *   • the three finder eyes are rounded rings with an ember core,
 *   • the frame and quiet zone are sized so phone scanners lock on fast.
 *
 * The data modules stay near-black on white on purpose. Accent-coloured data
 * modules fail luminance thresholds on cheaper scanners, and a stylish QR that
 * does not scan is worse than a plain one that does — so the brand colour lives
 * in the eye cores, which are redundant data the decoder reconstructs from the
 * ring around them.
 */
export async function drawShopQR(
  canvas: HTMLCanvasElement,
  { url, size, accent = '#FF4D2E' }: ShopQROptions,
): Promise<void> {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'Q' });
  const n = qr.modules.size;
  const data = qr.modules.data;

  const quiet = 2; // quiet-zone margin, in modules
  const cells = n + quiet * 2;
  const cell = size / cells;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Paper background — scanners need the light field around the modules.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const dark = '#0B0B10';
  const isDark = (x: number, y: number) => data[y * n + x] === 1;
  // Finder eyes are drawn separately; skip their cells in the module pass.
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  // ── Data modules as rounded dots ────────────────────────────────────────
  ctx.fillStyle = dark;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!isDark(x, y) || inFinder(x, y)) continue;
      const pad = cell * 0.07;
      const px = (x + quiet) * cell + pad;
      const py = (y + quiet) * cell + pad;
      const side = cell - pad * 2;
      roundRect(px, py, side, side, side * 0.38);
      ctx.fill();
    }
  }

  // ── Finder eyes: rounded ring, white gap, ember core ───────────────────
  const eyes: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  for (const [ex, ey] of eyes) {
    const x = (ex + quiet) * cell;
    const y = (ey + quiet) * cell;
    const s = 7 * cell;

    ctx.fillStyle = dark;
    roundRect(x, y, s, s, cell * 1.4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    const g1 = cell;
    roundRect(x + g1, y + g1, s - g1 * 2, s - g1 * 2, cell * 0.9);
    ctx.fill();

    ctx.fillStyle = accent;
    const g2 = cell * 2;
    roundRect(x + g2, y + g2, s - g2 * 2, s - g2 * 2, cell * 0.6);
    ctx.fill();
  }
}
