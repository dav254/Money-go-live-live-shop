'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { drawShopQR } from './draw-shop-qr';

type ShopQRDotsProps = {
  shopId: string;
  shopUrl: string;
  accentColor?: string;
  size?: number;
  pitchLine?: string;
  /** Render a Download PNG control under the canvas. */
  showDownload?: boolean;
  className?: string;
};

/**
 * Seller storefront QR — real code, unique look, download on demand.
 *
 * The first version of this component drew a decorative hash pattern (scanned
 * to nothing) and fired a file download from a `useEffect` on mount, so merely
 * *rendering* the card dropped a PNG in the seller's downloads folder. Both
 * are gone: the matrix is encoded from the real shop URL by `drawShopQR`, and
 * the PNG leaves only when the seller presses Download.
 *
 * `shopUrl` may be an empty string while the page resolves its origin — the
 * draw is skipped until there is something worth encoding, and re-runs when
 * the real URL arrives.
 */
const ShopQRDots = ({
  shopId,
  shopUrl = '',
  accentColor = '#FF4D2E',
  size = 420,
  pitchLine,
  showDownload = false,
  className,
}: ShopQRDotsProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shopUrl) return;
    drawShopQR(canvas, { url: shopUrl, size, accent: accentColor }).catch(() => {
      /* an unencodable URL leaves the blank canvas — never crash the page */
    });
  }, [shopUrl, size, accentColor, shopId]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !shopUrl) return;
    const link = document.createElement('a');
    link.download = `${shopId.toLowerCase().replace(/\s+/g, '-')}-shop-qr.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <figure className={className} style={{ width: size, margin: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
          borderRadius: '16px',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        aria-label={`QR code for ${shopUrl || 'your shop'}`}
        role="img"
      />
      {pitchLine && (
        <figcaption
          style={{
            marginTop: 8,
            fontSize: 12,
            letterSpacing: '0.04em',
            color: '#8b939c',
            textAlign: 'center',
          }}
        >
          {pitchLine}
        </figcaption>
      )}
      {showDownload && (
        <button
          type="button"
          onClick={download}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Download PNG
        </button>
      )}
    </figure>
  );
};

export { ShopQRDots };
