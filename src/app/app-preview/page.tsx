'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSkeleton } from '@/components/app/app-skeleton';

/**
 * Legacy entry point. The app now lives at /app, which routes each role into
 * their own section of the website. This redirect exists only so the installed
 * PWA, bookmarks and older links keep working.
 */
export default function AppPreviewRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <AppSkeleton className="h-10 w-10 rounded-full" />
    </div>
  );
}