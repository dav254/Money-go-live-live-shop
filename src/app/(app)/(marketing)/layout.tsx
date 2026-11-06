'use client';

import { AppSurfaceFrame } from '@/components/app/app-surface-frame';
import { AnalyticsGate } from '@/components/analytics-gate';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { GlobalErrorListener } from '@/components/GlobalErrorListener';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { RoleBoundary } from '@/components/auth/role-boundary';
import { SecurityShield } from '@/components/SecurityShield';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import { SurfaceBoundary } from '@/components/auth/surface-boundary';
import { SectionGate } from '@/components/auth/section-gate';
import { Providers } from '@/app/providers';
import { publicOrigin } from '@/lib/site-url';
import { buildOrganizationJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';

export const metadata = {
  title: 'Vidnov — Discover. Connect. Shop.',
  description:
    'Discover a different way to shop, connect and grow. Find real products, services and businesses, watch live demos, and connect directly with sellers on Vidnov.',
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
  openGraph: {
    title: 'Vidnov — Discover. Connect. Shop.',
    description:
      'Discover a different way to shop, connect and grow. Find real products, services and businesses, watch live demos, and connect directly with sellers.',
    siteName: 'Vidnov',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vidnov — Discover. Connect. Shop.',
    description:
      'Find real products, services and businesses, watch live demos, and connect directly with sellers on Vidnov.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  canonical: 'https://vidnov.com/',
  verification: {
    other: {
      'msvalidate.01': '65BCB3F6E5C04EAAFC7BE59684ADBF43',
    },
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18520240461"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18520240461');`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KKSDKPJC');`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildOrganizationJsonLd()),
          }}
        />
      </head>
      <body className="min-h-screen bg-[#090909] text-[#f9f5ee] antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KKSDKPJC"
            height={0}
            width={0}
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
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
