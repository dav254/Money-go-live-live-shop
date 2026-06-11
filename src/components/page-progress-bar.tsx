'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

/**
 * High-velocity Top Loading Bar.
 * Logic: Instantly jumps to 70% on click to provide immediate feedback.
 * Completes to 100% on page load.
 */
export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Finish on arrival
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    NProgress.configure({ 
      showSpinner: false,
      trickleSpeed: 200,
      minimum: 0.1
    });

    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href && !anchor.target && !anchor.href.includes('#')) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
          // Check if it's an internal navigation
          if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
            // High velocity jump to 70%
            NProgress.start();
            NProgress.set(0.7); 
          }
        }
      } catch (err) {
        // Fallback for unexpected URL formats
        NProgress.start();
        NProgress.set(0.7);
      }
    };

    window.addEventListener('click', handleAnchorClick);

    return () => {
        window.removeEventListener('click', handleAnchorClick);
    }
  }, []);

  return null;
}
