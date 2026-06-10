'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const bar = document.getElementById("global-loading-bar");
    if (bar) {
      // On arrival, complete to 100% and fade out
      bar.style.width = "100%";
      setTimeout(() => {
        bar.style.opacity = "0";
        setTimeout(() => {
          bar.style.width = "0%";
        }, 300);
      }, 200);
    }
  }, [pathname, searchParams, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href && !anchor.target) {
        try {
          const url = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);

          // Only trigger for internal navigations that change the path
          if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
            const bar = document.getElementById("global-loading-bar");
            if (bar) {
              bar.style.opacity = "1";
              bar.style.width = "70%"; // Instant 70% jump
            }
          }
        } catch (err) {
          // Ignore invalid URLs
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div 
      id="global-loading-bar" 
      className="loading-bar" 
      style={{ opacity: 0 }} 
    />
  );
}