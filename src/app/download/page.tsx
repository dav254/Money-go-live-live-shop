import type { Metadata } from 'next';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  Globe,
  Info,
  ScanLine,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import {
  ANDROID_APP,
  DOWNLOAD_PAGE_PATH,
  IS_PUBLISHED,
  PLAY_STORE_URL,
  QR_TARGET_URL,
} from '@/lib/android-app';

export const metadata: Metadata = {
  title: 'Download the Vidnov Android app',
  description:
    'Vidnov for Android — a native marketplace app for shopping, selling, live sessions and AI Studio. Install from Google Play once published, or keep using vidnov.com in any browser.',
  alternates: { canonical: 'https://vidnov.com/download' },
  openGraph: {
    title: 'Download the Vidnov Android app',
    description:
      'Native Android app for Vidnov: browse, buy, message sellers, go live. The website stays available for everyone.',
    url: 'https://vidnov.com/download',
    siteName: 'Vidnov',
    type: 'website',
  },
};

/**
 * /download — the permanent install page.
 *
 * Deliberately a real page and not a redirect. Three audiences land here:
 *
 *   • a phone that tapped "Download the app" — needs a button that works or an
 *     honest "not yet";
 *   • a desktop visitor who scans the QR code — needs a code that goes
 *     somewhere true, whichever state publishing is in;
 *   • anyone who would rather not install anything — needs a way straight into
 *     the website, because the web app is a complete product and not a
 *     consolation prize.
 *
 * There is no automatic redirect in either direction: the page never bounces a
 * browser into a store it did not ask for, and the app never bounces a user out
 * to the web.
 *
 * The QR code is generated server-side from `QR_TARGET_URL`, so it cannot drift
 * from what the button does — published, it encodes the verified Play listing;
 * unpublished, it encodes this page, which is the honest destination.
 */
export default async function DownloadPage() {
  const qrDataUrl = await QRCode.toDataURL(QR_TARGET_URL, {
    margin: 1,
    width: 320,
    color: { dark: '#0a0a0b', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  }).catch(() => null);

  return (
    <LandingLayout>
      <div className="relative overflow-hidden bg-[#090909] text-[#f9f5ee]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,82,54,0.20),transparent_30%),linear-gradient(180deg,#090909_0%,#101010_100%)]"
        />

        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/40 bg-[#111111]/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-[#f9d4c4]">
            <Smartphone className="h-3.5 w-3.5" />
            Vidnov mobile
          </div>

          <h1 className="mt-6 max-w-3xl font-grotesk text-[clamp(2.6rem,6vw,4.8rem)] font-black leading-[0.92] tracking-[-0.06em] text-white">
            GET VIDNOV ON
            <span className="block text-[#ff5a36]">ANDROID.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#d6cfc5]">
            A native application — not a website in a frame. Browse the marketplace, message
            sellers, track orders, run your shop and generate images in AI Studio, all from a real
            Android app using your existing Vidnov account.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            {/* ── Status + install ─────────────────────────────────────── */}
            <div className="rounded-[28px] border border-[#ff5a36]/20 bg-[linear-gradient(140deg,rgba(255,90,54,0.09),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.45)] sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${
                    IS_PUBLISHED
                      ? 'border border-[#2fbf71]/40 bg-[#2fbf71]/10 text-[#7ce0ac]'
                      : 'border border-[#f5a524]/40 bg-[#f5a524]/10 text-[#ffcf85]'
                  }`}
                >
                  {IS_PUBLISHED ? <Check className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                  {IS_PUBLISHED ? 'Available on Google Play' : 'Coming soon to Google Play'}
                </span>
                <span className="rounded-full border border-white/10 bg-[#151515] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a79e95]">
                  v{ANDROID_APP.versionName} · build {ANDROID_APP.versionCode}
                </span>
              </div>

              {IS_PUBLISHED ? (
                <>
                  <p className="mt-5 text-sm leading-relaxed text-[#cfc7bd]">
                    Install Vidnov from the official Google Play listing. Updates arrive through Play,
                    so the app you install today keeps getting fixes automatically.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="h-12 rounded-full border border-[#ff5a36] bg-[#ff5a36] px-7 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.32)] hover:-translate-y-0.5 hover:bg-[#ff6a49]"
                    >
                      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Get it on Google Play
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="h-12 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
                    >
                      <Link href="/buyer/discovery">Use the website instead</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-sm leading-relaxed text-[#cfc7bd]">
                    The Android app is built and being prepared for Google Play review. There is{' '}
                    <strong className="text-white">no public download yet</strong> — and we will not
                    offer an unsigned APK from this page, because installing one would leave your
                    account and payments unprotected.
                  </p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-4">
                    <p className="flex items-start gap-2 text-sm text-[#e8e0d6]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a524]" />
                      <span>
                        When the app goes live, this button becomes the real Google Play link. Until
                        then the full Vidnov marketplace — every shop, order, message and live room —
                        is already here on the website.
                      </span>
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      size="lg"
                      disabled
                      className="h-12 cursor-not-allowed rounded-full border border-white/12 bg-[#1a1a1a] px-7 text-sm font-bold text-[#8a8179]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Android app coming soon
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="h-12 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
                    >
                      <Link href="/buyer/discovery">
                        Shop on the website
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}

              <dl className="mt-8 grid gap-3 border-t border-white/10 pt-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a8179]">
                    Android version
                  </dt>
                  <dd className="mt-1 text-[#e8e0d6]">{ANDROID_APP.minimumAndroid}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a8179]">
                    Download size
                  </dt>
                  <dd className="mt-1 text-[#e8e0d6]">{ANDROID_APP.approximateSize}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a8179]">
                    Application ID
                  </dt>
                  <dd className="mt-1 font-mono text-[13px] text-[#e8e0d6]">{ANDROID_APP.packageId}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a8179]">
                    Price
                  </dt>
                  <dd className="mt-1 text-[#e8e0d6]">Free — your account works on both</dd>
                </div>
              </dl>
            </div>

            {/* ── QR ───────────────────────────────────────────────────── */}
            <div className="rounded-[28px] border border-white/10 bg-[#101010] p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcfbf]">
                <ScanLine className="h-4 w-4" />
                On your phone
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#b9b1a8]">
                {IS_PUBLISHED
                  ? 'Scan this code with your Android camera to open the official Google Play listing.'
                  : 'Scan this code to open this page on your phone, so it is saved with the correct link when the app goes live.'}
              </p>

              <div className="mt-5 flex justify-center">
                {qrDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrDataUrl}
                    alt={
                      IS_PUBLISHED
                        ? 'QR code for the official Vidnov Google Play listing'
                        : 'QR code for the Vidnov Android download page'
                    }
                    width={220}
                    height={220}
                    className="h-[220px] w-[220px] rounded-2xl border border-white/10 bg-white p-2"
                  />
                ) : (
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-white/10 bg-[#161616] text-center text-xs text-[#8a8179]">
                    QR code unavailable — use the button instead.
                  </div>
                )}
              </div>

              <p className="mt-4 break-all text-center font-mono text-[11px] text-[#6f6862]">
                {QR_TARGET_URL.replace(/^https?:\/\//, '')}
              </p>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-[#b9b1a8]">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2fbf71]" />
                  Only install Vidnov from this page or the official Google Play listing. Never from
                  a third-party APK mirror.
                </p>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-[#b9b1a8]">
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff5a36]" />
                  iPhone: there is no iOS build at this time. Use vidnov.com in Safari — the same
                  account, the same marketplace.
                </p>
              </div>
            </div>
          </div>

          {/* ── What is inside ─────────────────────────────────────────── */}
          <div className="mt-14">
            <h2 className="font-grotesk text-2xl font-black tracking-[-0.03em] text-white">
              What&apos;s in the app
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Shopping', 'Native product and service feed, listing pages, shops and saved items.'],
                ['Messaging', 'Real conversations with buyers and sellers, in a native thread.'],
                ['Orders', 'Buyer order history and seller fulfilment, updated in place.'],
                ['Requests & offers', 'Post a brief or reply to one with an offer.'],
                ['AI Studio', 'Generate images from a prompt or from your own photo.'],
                ['Seller dashboard', 'What needs action, listings and delivered revenue.'],
                ['Live discovery', 'See who is broadcasting right now.'],
                ['Notifications', 'Order, offer and message alerts in one place.'],
                ['Secure sessions', 'Sign-in tokens live in the Android Keystore, never in plain files.'],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-[#111111] p-4 transition-colors hover:border-[#ff5a36]/30"
                >
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#a79e95]">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Website alternative ────────────────────────────────────── */}
          <div className="mt-12 rounded-[24px] border border-white/10 bg-[#101010] p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcfbf]">
                  <Globe className="h-3.5 w-3.5" />
                  Prefer the browser?
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#b9b1a8]">
                  vidnov.com is the complete marketplace and always will be. The app is an
                  additional way in, not a replacement — nothing is app-only.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 shrink-0 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
              >
                <Link href="/buyer/discovery">
                  Open the marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-[#6f6862]">
            This page is the permanent Vidnov download address ({DOWNLOAD_PAGE_PATH}). It is updated
            the moment the Google Play listing is verified; there is never a temporary redirect here.
          </p>
        </section>
      </div>
    </LandingLayout>
  );
}
