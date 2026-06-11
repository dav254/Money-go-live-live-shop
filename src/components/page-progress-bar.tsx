'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

/**
 * High-velocity Top Loading Bar.
 * Logic: Smoothly handles navigation transitions with the requested Red (#ff0000) visual identity.
 */
export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Complete the progress bar when the route officially changes
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    NProgress.configure({ 
      showSpinner: false,
      trickleSpeed: 150,
      minimum: 0.1,
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
        // Silent catch for unexpected URL formats or cross-origin edge cases
        console.warn("[Progress] Handshake error:", err);
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