
import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { SecurityShield } from '@/components/SecurityShield';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Vidnov: Post • Earn • Repeat',
  description: 'The world\'s next-generation social earning platform. Where creative motion becomes financial yield.',
  icons: {
    icon: '/favicon.ico',
  },
  metadataBase: new URL('https://vidnov.com'),
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S7TZ4F1JMR"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-S7TZ4F1JMR');
          `}
        </Script>
        <SecurityShield />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
