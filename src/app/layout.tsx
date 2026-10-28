import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { publicOrigin } from '@/lib/site-url';
import { Providers } from './providers';
import { RoleBoundary } from '@/components/auth/role-boundary';
import { SurfaceBoundary } from '@/components/auth/surface-boundary';
import { SectionGate } from '@/components/auth/section-gate';
import { AppSurfaceFrame } from '@/components/app/app-surface-frame';
import { SecurityShield } from '@/components/SecurityShield';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { AnalyticsGate } from '@/components/analytics-gate';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

export const metadata: Metadata = {
  title: 'Vidnov — Post. Earn. Repeat.',
  description: 'Discover a different way to connect businesses and people. Vidnov is where businesses, creators and customers meet.',
  manifest: '/manifest.json',
  applicationName: 'Vidnov',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vidnov',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  metadataBase: new URL(publicOrigin()),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          GOOGLE TAG MANAGER — the loader, as high in <head> as Google's
          install instructions require. This is the ONE place GTM lives for
          every page (the root layout covers the whole app); there is no
          second snippet anywhere on purpose. To move containers, change the
          id here — old snippets must be deleted, never stacked.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KKSDKPJC');`,
          }}
        />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background antialiased'
        )}
      >
        {/*
          Google Tag Manager noscript — Google requires it immediately after
          the opening <body> tag so non-JavaScript visitors are still counted.
        */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KKSDKPJC"
            height={0}
            width={0}
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        {/* Google Analytics loads only after the visitor accepts cookies —
            see AnalyticsGate + lib/cookie-consent. */}
        <AnalyticsGate />
        <meta name="theme-color" content="#FF4D2E" />
        <SecurityShield />
        <Providers>
          <SurfaceBoundary>
            <AppSurfaceFrame>
              <SectionGate>
                <RoleBoundary>{children}</RoleBoundary>
              </SectionGate>
            </AppSurfaceFrame>
          </SurfaceBoundary>
        </Providers>
        <ServiceWorkerRegistrar />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
