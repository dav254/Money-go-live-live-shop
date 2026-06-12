import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { SecurityShield } from '@/components/SecurityShield';

export const metadata: Metadata = {
  title: 'GoEarnvid: Post • Earn • Repeat',
  description: 'The world\'s next-generation social earning platform. Where creative motion becomes financial yield.',
  icons: {
    icon: '/favicon.ico',
  },
  metadataBase: new URL('https://goearnvid.shop'),
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
        <SecurityShield />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
