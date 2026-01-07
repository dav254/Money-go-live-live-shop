
'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, initializeFirebase } from '@/firebase';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { GlobalErrorListener } from '@/components/GlobalErrorListener';
import { Toaster } from '@/components/ui/toaster';
import { CurrencyProvider } from '@/context/currency-context';

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
        <CurrencyProvider>
          <GlobalErrorBoundary>
            <GlobalErrorListener />
            {children}
            <Toaster />
          </GlobalErrorBoundary>
        </CurrencyProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
