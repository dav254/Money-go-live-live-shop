'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageProgressBar() {
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startLoading = () => {
    setLoading(true);
    // Small timeout to allow width 0 to be applied if it was recently finished
    setTimeout(() => {
      setWidth(70);
    }, 10);
  };

  const finishLoading = () => {
    setWidth(100);
    setTimeout(() => {
      setWidth(0);
      setLoading(false);
    }, 300);
  };

  // Logic to finish loading when route changes
  useEffect(() => {
    finishLoading();
  }, [pathname, searchParams]);

  // Handle link clicks to start loading
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
        // Ignore invalid URLs
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

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