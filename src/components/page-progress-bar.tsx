
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When the path or search params change, the new page has arrived.
    // We finish the loading state.
    const finishLoading = () => {
      const bar = document.getElementById("loadingBar");
      if (bar) {
        bar.style.width = "100%";
        setTimeout(() => {
          bar.style.width = "0";
          setLoading(false);
        }, 300);
      }
    };

    finishLoading();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href && !anchor.target) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
          // Only trigger for internal links that aren't hashes
          if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
            setLoading(true);
            const bar = document.getElementById("loadingBar");
            if (bar) {
              bar.style.width = "70%";
            }
          }
        }
      } catch (err) {
        // Silent fail for invalid URLs
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div 
      id="loadingBar" 
      className="loading-bar" 
      style={{ opacity: loading ? 1 : 0 }} 
    />
  );
}
