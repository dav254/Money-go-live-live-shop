'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '@/lib/error-logging';
import { initializeFirebase } from '@/firebase';

interface Props {
  children: ReactNode;
  userId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * A robust Error Boundary that handles runtime crashes without spiraling into infinite loops.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for development visibility
    console.error("Uncaught error caught by GlobalErrorBoundary:", error, errorInfo);
    
    // Attempt to log error to Firestore asynchronously
    try {
        const { firestore } = initializeFirebase();
        if (firestore) {
            logError(firestore, error, { 
                userId: this.props.userId,
                context: { 
                    componentStack: errorInfo?.componentStack,
                    type: 'boundary-catch'
                }
            });
        }
    } catch (e) {
        // If logging fails (e.g. Firebase not ready), silent fail to avoid UI crash
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-6 text-center">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-primary mb-2">SYSTEM SIGNAL INTERRUPTED</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-sm mb-8 leading-relaxed">
                An unexpected application error has occurred. Our engineers have been alerted via the automated discovery protocol.
            </p>
            <button 
                onClick={() => window.location.reload()}
                className="h-12 px-8 bg-primary text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
                REBOOT SIGNAL
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}