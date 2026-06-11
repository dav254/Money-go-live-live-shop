'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

/**
 * High-velocity Red Loading Bar (#ff0000).
 * Logic: Jumps to 70% instantly on any internal click to provide extreme perceived performance.
 */
export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Complete the progress bar when the route change is confirmed
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    NProgress.configure({ 
      showSpinner: false,
      trickleSpeed: 100,
      minimum: 0.7, // Instant jump to 70% on start
      speed: 300,
    });

    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href && !anchor.target && !anchor.href.includes('#')) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
          // Only trigger for internal links that actually change the path
          if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
            NProgress.start();
          }
        }
      } catch (err) {
        console.warn("[Progress] Signal interrupted:", err);
      }
    };

    window.addEventListener('click', handleAnchorClick);

    return () => {
        window.removeEventListener('click', handleAnchorClick);
        NProgress.done();
    }
  }, []);

  return null;
}
