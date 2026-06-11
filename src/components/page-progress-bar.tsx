'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * High-velocity Top Loading Bar.
 * Logic: Smoothly handles navigation transitions with the requested Red (#ff0000) visual identity.
 */
export function PageProgressBar() {
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

<<<<<<< HEAD
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
=======
  const startLoading = useCallback(() => {
    setLoading(true);
    // Instant jump to 70% as requested for high-velocity feel
    setWidth(70);
  }, []);

  const finishLoading = useCallback(() => {
    setWidth(100);
    const timer = setTimeout(() => {
      setWidth(0);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    finishLoading();
  }, [pathname, searchParams, finishLoading]);
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href && !anchor.target && !anchor.href.includes('#')) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
<<<<<<< HEAD
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
=======
          const isInternal = targetUrl.origin === currentUrl.origin;
          const isSamePage = targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;

          if (isInternal && !isSamePage && !anchor.hasAttribute('download') && anchor.target !== '_blank') {
            startLoading();
          }
        }
      } catch (err) {
        // Safe fail
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [startLoading]);

  return (
    <div 
        id="loadingBar" 
        className="loading-bar" 
        style={{ 
            width: `${width}%`,
            opacity: loading || width > 0 ? 1 : 0 
        }} 
    />
  );
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
}