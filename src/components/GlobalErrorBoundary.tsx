'use client';

import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { logError } from '@/lib/error-logging';
import { useFirestore } from '@/firebase';
import { Firestore } from 'firebase/firestore';

interface Props {
  children: ReactNode;
  userId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const ErrorLogger = ({ firestore, error, errorInfo, userId }: { firestore: Firestore, error: Error, errorInfo: ErrorInfo, userId?: string }) => {
  useEffect(() => {
    logError(firestore, error, { 
      userId,
      context: { 
        componentStack: errorInfo.componentStack 
      }
    });
  }, [firestore, error, errorInfo, userId]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-bold text-destructive">Something went wrong.</h1>
      <p className="text-muted-foreground">An error has been logged. Please try refreshing the page.</p>
    </div>
  );
};

const FirebaseAwareErrorLogger = ({ error, errorInfo, userId }: { error: Error, errorInfo: ErrorInfo, userId?: string }) => {
    const firestore = useFirestore();
    return <ErrorLogger firestore={firestore} error={error} errorInfo={errorInfo} userId={userId} />
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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      return (
        <FirebaseAwareErrorLogger 
          error={this.state.error} 
          errorInfo={this.state.errorInfo} 
          userId={this.props.userId} 
        />
      );
    }

    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}
