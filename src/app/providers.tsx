
'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, initializeFirebase } from '@/firebase';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { GlobalErrorListener } from '@/components/GlobalErrorListener';
import { Toaster } from '@/components/ui/toaster';
import { Suspense } from 'react';
import { PageProgressBar } from '@/components/page-progress-bar';
import { OfflineIndicator } from '@/components/OfflineIndicator';

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
             <Suspense fallback={null}>
                <PageProgressBar />
            </Suspense>
            {children}
            <Toaster />
            <OfflineIndicator />
          </GlobalErrorBoundary>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
