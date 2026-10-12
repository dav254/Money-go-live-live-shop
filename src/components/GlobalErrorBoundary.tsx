'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';


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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep a development console trail without relying on any wrapped console
    // method that might itself be intercepted.
    if (typeof window !== 'undefined' && (window as any).console) {
      try {
        (window as any).console.error(
          'Uncaught error caught by GlobalErrorBoundary:',
          error,
          errorInfo,
        );
      } catch {
        // If even that fails, drop the log rather than crash again.
      }
    }

    // Defer log shipping to the async error logger. The legacy Firestore path
    // is intentionally not called from inside componentDidCatch: that handler
    // can be entered while React is mid-commit, and any Firestore call that
    // touches React internals, the console interceptor, or the auth surface
    // would risk turning one caught error into another.
    try {
      const enqueue = typeof window !== 'undefined'
        ? (window as any).__deferredErrorLoggerEnqueue
        : undefined;
      if (enqueue) {
        enqueue(error, {
          userId: this.props.userId,
          context: {
            componentStack: errorInfo?.componentStack,
            type: 'boundary-catch',
          },
        });
      }
    } catch {
      // Logging failures should not turn one error into two. The fallback
      // renders regardless of anything that happens in componentDidCatch.
    }

    // If the caught error itself was thrown by the dev overlay re-rendering
    // the boundary tree (observed as a recursive commitLayoutEffect loop),
    // break the cycle by forcing a reload after the fallback renders once.
    if (typeof window !== 'undefined') {
      try {
        (window as any).__boundaryCaughtError = error;
        (window as any).__boundaryCaughtErrorInfo = errorInfo;
      } catch {}
    }
  }

  public render() {
    if (this.state.hasError) {
      // Avoid the recursive dev-overlay commit loop by reloading once the
      // fallback has rendered. The user-facing button is still there as a
      // manual escape hatch; this is the automated one.
      if (typeof window !== 'undefined') {
        try {
          if ((window as any).__boundaryCaughtError) {
            setTimeout(() => { window.location.reload(); }, 0);
          }
        } catch {}
      }

      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-6 text-center">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-primary mb-2">
            SYSTEM SIGNAL INTERRUPTED
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-sm mb-8 leading-relaxed">
            An unexpected application error has occurred. Our engineers have been alerted
            via the automated discovery protocol.
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
