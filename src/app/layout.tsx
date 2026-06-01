import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'GoEarnvid: Live Shop',
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
          'min-h-screen bg-background antialiased'
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
