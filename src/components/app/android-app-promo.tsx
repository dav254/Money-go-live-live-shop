import Link from 'next/link';
import { ArrowRight, Bell, Download, Heart, Home, MessageCircle, Search, Sparkles, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ANDROID_APP,
  DOWNLOAD_PAGE_PATH,
  IS_PUBLISHED,
  PLAY_STORE_URL,
} from '@/lib/android-app';

/**
 * HOME APP PROMOTION.
 *
 * One section, on the dark landing surface, that answers three questions in the
 * order a visitor asks them: there is an Android app, what does it do, how do I
 * get it.
 *
 * The phone is drawn in CSS — it is an illustration of the app's own layout, not
 * a screenshot of a browser. That distinction matters: the app is a native
 * React Native surface, and a promo that showed a shrunken website would both
 * misrepresent it and undercut the whole point of building it.
 *
 * The button never lies. `IS_PUBLISHED` is driven by a verified Play URL in the
 * environment; until that exists this renders "coming soon" and sends people to
 * `/download`, which states the real status. No invented store link, no
 * unverified APK.
 */
export function AndroidAppPromo() {
  return (
    <section
      id="android-app"
      aria-labelledby="android-app-heading"
      className="relative overflow-hidden border-t border-[#ff5a36]/20 bg-[#0b0b0b]"
    >
      {/* Signal glow behind the device. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,90,54,0.22),transparent_65%)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/40 bg-[#141414] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-[#ffcfbf]">
              <Download className="h-3.5 w-3.5" />
              Vidnov for Android
            </div>

            <h2
              id="android-app-heading"
              className="mt-6 font-grotesk text-[clamp(2.1rem,4.6vw,3.6rem)] font-black leading-[0.95] tracking-[-0.05em] text-white"
            >
              THE MARKETPLACE,
              <span className="block text-[#ff5a36]">IN YOUR POCKET.</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#d6cfc5]">
              A real Android application — native screens, native navigation, built for a phone
              rather than a browser window. Same Vidnov account, same shops, same orders and the
              same messages you have on the web.
            </p>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Store, text: 'Browse and buy with a native product feed' },
                { icon: MessageCircle, text: 'Message sellers inside the app' },
                { icon: Sparkles, text: 'AI Studio for image generation' },
                { icon: Bell, text: 'Order, offer and message alerts' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-[#c9c1b8]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff5a36]/30 bg-[#161616]">
                    <Icon className="h-3.5 w-3.5 text-[#ff5a36]" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {IS_PUBLISHED ? (
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
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full border border-[#ff5a36] bg-[#ff5a36] px-7 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.32)] hover:-translate-y-0.5 hover:bg-[#ff6a49]"
                  >
                    <Link href={DOWNLOAD_PAGE_PATH}>
                      <Download className="mr-2 h-4 w-4" />
                      Download the Vidnov App
                    </Link>
                  </Button>
                  <span className="rounded-full border border-white/12 bg-[#151515] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a79e95]">
                    Android app coming soon
                  </span>
                </>
              )}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#8a8179]">
              {IS_PUBLISHED
                ? `Version ${ANDROID_APP.versionName} · ${ANDROID_APP.minimumAndroid} · ${ANDROID_APP.approximateSize}`
                : `Preparing for Google Play · ${ANDROID_APP.minimumAndroid} · no sideloaded APKs, ever`}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[320px]">
            <PhonePreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The device illustration.
 *
 * Every element here mirrors a screen that actually exists in `mobile/app` — the
 * home feed, the LIVE strip, the five-item tab bar. Nothing is drawn that the app
 * does not render, so the promotion cannot promise a screen the product lacks.
 */
function PhonePreview() {
  return (
    <div className="relative rounded-[2.4rem] border border-white/12 bg-[#0a0a0b] p-2.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)]">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0d0d0f]">
        {/* status bar */}
        <div className="flex items-center justify-between px-4 pb-1 pt-2 text-[9px] font-semibold text-[#8c8c95]">
          <span>9:41</span>
          <span className="h-1.5 w-16 rounded-full bg-black" aria-hidden />
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2fbf71]" />
            LTE
          </span>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <span className="font-grotesk text-[15px] font-black tracking-tight text-white">Vidnov</span>
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#18181b]">
            <Bell className="h-3.5 w-3.5 text-[#f2f2f4]" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ff5a36]" />
          </span>
        </div>

        {/* welcome + search */}
        <div className="px-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6b6b73]">
            Discover Vidnov
          </p>
          <p className="mt-1 font-grotesk text-[19px] font-black leading-tight tracking-tight text-white">
            Post. Earn. Repeat.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-white/8 bg-[#161618] px-3 py-2">
            <Search className="h-3 w-3 text-[#6b6b73]" />
            <span className="text-[9.5px] text-[#6b6b73]">Search products and shops</span>
          </div>
        </div>

        {/* quick actions */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 px-4">
          {[
            { icon: Store, label: 'Shop' },
            { icon: Download, label: 'Orders' },
            { icon: Sparkles, label: 'Studio' },
            { icon: Heart, label: 'Saved' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/6 bg-[#161618] py-2"
            >
              <Icon className="h-3 w-3 text-[#ff5a36]" />
              <span className="text-[7.5px] font-semibold text-[#9a9aa2]">{label}</span>
            </div>
          ))}
        </div>

        {/* live strip */}
        <div className="mt-4 flex items-center justify-between px-4">
          <span className="text-[10px] font-bold text-white">Live now</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#ff5a36]">See all</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-hidden px-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-[linear-gradient(135deg,rgba(255,90,54,0.35),rgba(10,10,11,0.9))]"
            >
              <span className="absolute left-1.5 top-1.5 rounded-full bg-[#ff5a36] px-1.5 py-0.5 text-[6.5px] font-black text-[#150d0b]">
                LIVE
              </span>
              <span className="absolute inset-x-1.5 bottom-1.5 text-[7px] font-semibold leading-tight text-white">
                {i === 0 ? 'Streetwear drop' : 'Beauty picks'}
              </span>
            </div>
          ))}
        </div>

        {/* product grid */}
        <div className="mt-4 flex items-center justify-between px-4">
          <span className="text-[10px] font-bold text-white">Fresh on Vidnov</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 px-4 pb-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-white/6 bg-[#161618]"
            >
              <div
                className="h-16 w-full bg-[linear-gradient(135deg,#232326,#131315)]"
                aria-hidden
              />
              <div className="space-y-1 p-1.5">
                <div className="h-1.5 w-4/5 rounded-full bg-white/12" aria-hidden />
                <div className="h-1.5 w-2/5 rounded-full bg-[#ff5a36]/60" aria-hidden />
              </div>
            </div>
          ))}
        </div>

        {/* tab bar */}
        <div className="flex items-center justify-around border-t border-white/8 bg-[#141416] px-2 py-2">
          {[
            { icon: Home, label: 'Home', active: true },
            { icon: Search, label: 'Discover' },
            { icon: MessageCircle, label: 'Messages' },
            { icon: Bell, label: 'Alerts' },
            { icon: Store, label: 'Profile' },
          ].map(({ icon: Icon, label, active }) => (
            <span key={label} className="flex flex-col items-center gap-0.5">
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#ff5a36]' : 'text-[#5f5f68]'}`} />
              <span
                className={`text-[6.5px] font-semibold ${active ? 'text-[#ff5a36]' : 'text-[#5f5f68]'}`}
              >
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small footer/nav entry so the promotion has a permanent, predictable address. */
export function AndroidAppLink({ className }: { className?: string }) {
  return (
    <Link
      href={DOWNLOAD_PAGE_PATH}
      className={className ?? 'inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff5a36]'}
    >
      Get the Android app
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
