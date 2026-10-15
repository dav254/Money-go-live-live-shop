'use client';

import * as React from 'react';
import { Copy, ExternalLink, Printer, QrCode, Share2, Smartphone } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ShopQRDots } from '@/components/shop/ShopQRDots';
import { publicOrigin } from '@/lib/site-url';
import {
  SellerCard,
  SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · SHARE & QR (`/app/seller/share`).
 *
 * ## Why a whole screen and not a corner of My Shop
 *
 * Sharing is a job, not a widget. The QR used to live partway down
 * `/app/seller/shop`, past the banner and the badges — a seller who opened the
 * app to hand a customer a code had to scroll for it, and nothing in the menu
 * said where it was. This screen is the destination: the code, the link, and
 * the two things you do with either, with nothing above them to wade through.
 *
 * ## The code is real
 *
 * `ShopQRDots` encodes the actual storefront URL through the `qrcode` encoder
 * (error correction Q) and draws the matrix itself — rounded dots and ember
 * finder-eye cores — so the code is unique to this shop, scannable from a
 * printed sticker, and downloadable as a PNG straight from the card. The URL
 * is resolved from `publicOrigin()` — the canonical `vidnov.com` origin — so
 * the code, the copy button and the shop itself can never point at different
 * hosts, and never at whatever preview/local domain the app happens to be
 * served from (`window.location.origin` used to bake the sandbox host into
 * every QR code a seller printed).
 */
export default function AppSellerSharePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const sellerId = user?.uid ?? '';

  // Canonical public origin (`vidnov.com`) — not `window.location.origin`,
  // which would copy the host the app is being served from (preview domain,
  // localhost) into every share link and printed QR code.
  const origin = publicOrigin();
  const shopLink = origin && sellerId ? `${origin}/sellers/${sellerId}` : '';

  const copyLink = async () => {
    if (!shopLink) return;
    try {
      await navigator.clipboard.writeText(shopLink);
      toast({ title: 'Link copied', description: 'Your public shop link is on your clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy the link' });
    }
  };

  const shareLink = async () => {
    if (!shopLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My shop', url: shopLink });
        return;
      } catch {
        return; // the seller dismissed the sheet — not an error
      }
    }
    await copyLink();
  };

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle eyebrow="Share" title="Bring buyers to your shop" />

      {/* ── The QR — the reason this screen exists ─────────────────────── */}
      <section className="px-4">
        <SellerCard className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
                Shop QR code
              </p>
              <h3 className="mt-1 text-base font-bold text-white">One scan, one shop</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Download the image and print it for your counter, packaging or
                market stall — scanning it opens your storefront.
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <QrCode className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex justify-center">
            <ShopQRDots
              shopId={sellerId || 'shop'}
              shopUrl={shopLink}
              accentColor="#FF4D2E"
              size={264}
              pitchLine="Scan to reach your shop"
              showDownload
            />
          </div>
        </SellerCard>
      </section>

      {/* ── The link — copy it, share it, open it ──────────────────────── */}
      <section className="px-4">
        <SellerCard className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
            Your shop link
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            {shopLink ? (
              <span className="min-w-0 flex-1 truncate text-xs text-white">{shopLink}</span>
            ) : (
              <span className="min-w-0 flex-1 animate-pulse text-xs text-white/40">
                Resolving your shop link…
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!shopLink}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-red-500 px-4 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-red-500/25 transition hover:brightness-110 disabled:opacity-50 sm:flex-none"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </button>
            <button
              type="button"
              onClick={shareLink}
              disabled={!shopLink}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-50 sm:flex-none"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <a
              href={shopLink || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!shopLink}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-50 sm:flex-none"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open shop
            </a>
          </div>
        </SellerCard>
      </section>

      {/* ── Ideas — where the code works hardest ───────────────────────── */}
      <div className="grid gap-3 px-4 sm:grid-cols-2">
        <SellerCard className="p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-amber-400">
            <Printer className="h-4 w-4" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">Print it small</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            The code stays scannable from a sticker or a receipt — the eye
            cores carry the brand, the dots carry the data.
          </p>
        </SellerCard>

        <SellerCard className="p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-sky-400">
            <Smartphone className="h-4 w-4" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">Status &amp; stories</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Save the PNG once and post it to WhatsApp status or your stories —
            a tap on the image opens the same shop as a scan.
          </p>
        </SellerCard>
      </div>
    </div>
  );
}
