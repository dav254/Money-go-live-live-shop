
import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';

const fontManrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const fontSpaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Go Earn: Live Shop',
  description: 'A video-driven marketplace to buy and sell products.',
  icons: {
    icon: '/favicon.ico',
  },
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
          'min-h-screen bg-background font-body antialiased',
          fontManrope.variable,
          fontSpaceGrotesk.variable
        )}
      >
        <Providers>{children}</Providers>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
