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
          
          if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
            // High velocity jump to 70%
            NProgress.start();
            NProgress.set(0.7); 
          }
        }
      } catch (err) {
        NProgress.start();
      }
    };

    window.addEventListener('click', handleAnchorClick);

    // Patch router.push for programmatic navigation
    const originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      NProgress.start();
      NProgress.set(0.7);
      originalPushState.apply(window.history, args);
    };

    return () => {
        window.removeEventListener('click', handleAnchorClick);
        window.history.pushState = originalPushState;
    }
  }, []);

  return null;
}