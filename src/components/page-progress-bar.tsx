
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    NProgress.configure({ showSpinner: false });

    const handleAnchorClick = (event: MouseEvent) => {
      try {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor && anchor.href) {
          const targetUrl = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          if (targetUrl.origin === currentUrl.origin) {
            NProgress.start();
          }
        }
      } catch (err) {
        // Ignore errors from invalid URLs
        NProgress.start();
      }
    };

    const handleMutation: MutationCallback = () => {
      const anchorElements = document.querySelectorAll('a');
      anchorElements.forEach(anchor => anchor.addEventListener('click', handleAnchorClick));
    };

    const mutationObserver = new MutationObserver(handleMutation);
    mutationObserver.observe(document, { childList: true, subtree: true });

    // Fallback for router.push, etc.
    const originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      NProgress.start();
      originalPushState.apply(window.history, args);
    };

    return () => {
        mutationObserver.disconnect();
        window.history.pushState = originalPushState;
    }
  }, []);

  return null;
}
