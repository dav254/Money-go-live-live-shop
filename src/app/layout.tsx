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
      <body
        className={cn(
          'min-h-screen bg-background antialiased'
        )}
      >
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
