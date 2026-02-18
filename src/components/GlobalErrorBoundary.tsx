'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '@/lib/error-logging';
import { getFirestore, Firestore } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

interface Props {
  children: ReactNode;
  userId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * A fallback UI component that uses hooks but is wrapped by the class error boundary.
 */
function ErrorFallback({ error, errorInfo, userId }: { error: Error, errorInfo: ErrorInfo, userId?: string }) {
  // We initialize locally to avoid hook dependency issues during critical failures
  const { firestore } = initializeFirebase();
  
  React.useEffect(() => {
    if (firestore && error) {
      logError(firestore, error, { 
        userId,
        context: { 
          componentStack: errorInfo?.componentStack 
        }
      });
    }
  }, [firestore, error, errorInfo, userId]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <h1 className="text-2xl font-black uppercase tracking-tighter text-destructive mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">An application error has been logged. Please try refreshing the page or contact support.</p>
      <button 
        onClick={() => window.location.reload()}
        className="px-6 py-2 bg-primary text-white font-bold rounded-xl uppercase text-xs tracking-widest shadow-xl shadow-primary/20"
      >
        Refresh Page
      </button>
    </div>
  );
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error caught by GlobalErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      return (
        <ErrorFallback 
          error={this.state.error} 
          errorInfo={this.state.errorInfo} 
          userId={this.props.userId} 
        />
      );
    }

    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}
