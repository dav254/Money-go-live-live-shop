
'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, initializeFirebase } from '@/firebase';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { GlobalErrorListener } from '@/components/GlobalErrorListener';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const { firebaseApp, auth, firestore } = initializeFirebase();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <FirebaseProvider firebaseApp={firebaseApp} auth={auth} firestore={firestore}>
          <GlobalErrorBoundary>
            <GlobalErrorListener />
            {children}
            <Toaster />
          </GlobalErrorBoundary>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
