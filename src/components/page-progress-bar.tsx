'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageProgressBar() {
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
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
}