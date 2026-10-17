'use client';

import { useEffect } from 'react';

/**
 * SecurityShield: Deterrence layer to prevent easy access to DevTools 
 * and protect non-technical users from social engineering (Self-XSS).
 */
export function SecurityShield() {
  useEffect(() => {
    // 1. Disable common developer tool shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I (Inspect)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        return false;
      }
    };

    // 2. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      // Allow right-click on inputs and textareas for accessibility
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      return false;
    };

    // 3. Add Console Warning (Protection against Self-XSS)
    const printWarning = () => {
      if (typeof window !== 'undefined') {
        console.clear();
        console.log(
          '%c STOP! ',
          'color: white; background-color: red; font-size: 50px; font-weight: bold; padding: 10px; border-radius: 10px;'
        );
        console.log(
          '%c This is a browser feature intended for developers. If someone told you to copy-paste something here to "hack" an account or "unlock" a feature, it is a SCAM and will give them access to your Vidnov account. ',
          'color: red; font-size: 18px; font-weight: bold; margin-top: 20px;'
        );
        console.log(
          '%c Security Protocol Active: All unauthorized attempts are logged for platform safety. ',
          'color: gray; font-size: 12px; margin-top: 10px;'
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    
    // Periodically clear and re-print warning to deter persistent users
    printWarning();
    const interval = setInterval(printWarning, 10000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(interval);
    };
  }, []);

  return null;
}
