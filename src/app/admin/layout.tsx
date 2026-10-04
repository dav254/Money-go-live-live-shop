import type { Metadata } from 'next';

/**
 * ADMIN CONSOLE LAYOUT.
 *
 * Gives the admin application its own manifest and metadata so it installs as a
 * separate app on the home screen, distinct from the Vidnov consumer app.
 * Two apps, two icons, two sessions — an admin cannot be tricked into thinking
 * they are in the customer app, and vice versa.
 */
export const metadata: Metadata = {
  title: 'Vidnov Admin Console',
  description: 'Restricted administration console for the Vidnov platform.',
  manifest: '/manifest-admin.json',
  applicationName: 'Vidnov Admin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Admin',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  // Keep the console out of search results — it is not a public page.
  robots: { index: false, follow: false },
};

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}