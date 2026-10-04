'use client';

import { cn } from '@/lib/utils';

/** Small shared loading indicator for app surfaces. */
export function AppSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />;
}