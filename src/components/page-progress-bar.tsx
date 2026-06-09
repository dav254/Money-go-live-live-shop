'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function startLoading() {
    const el = document.getElementById("loadingBar");
    if (el) {
      el.style.width = "70%";
    }
  }

  function finishLoading() {
    const el = document.getElementById("loadingBar");
    if (el) {
      el.style.width = "100%";

      setTimeout(() => {
        if (el) {
          el.style.width = "0";
        }
      }, 300);
    }
  }

  useEffect(() => {
    // When path or params change, we consider the new page loaded/ready
    finishLoading();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href && !anchor.target && !anchor.download) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
          // Only start loading for internal navigations that change the path
          if (targetUrl.origin === currentUrl.origin && targetUrl.pathname !== currentUrl.pathname) {
            startLoading();
          }
        }
      } catch (err) {
        // Ignore errors from invalid URLs
      }
    };

    // Listen for all clicks on document to intercept link clicks
    document.addEventListener('click', handleAnchorClick);

    // Patch window.history.pushState for programmatic navigation (router.push)
    const originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      startLoading();
      originalPushState.apply(window.history, args);
    };

    return () => {
        document.removeEventListener('click', handleAnchorClick);
        window.history.pushState = originalPushState;
    }
  }, []);

  return <div id="loadingBar" className="loading-bar" style={{ width: '0' }} />;
}
