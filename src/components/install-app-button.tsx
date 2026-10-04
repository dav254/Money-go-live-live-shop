'use client';

import { useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isRunningStandalone,
  promptInstall,
  waitForInstallPrompt,
} from '@/lib/pwa-install';

/**
 * Install button: one tap, and the browser installs the app.
 *
 * There is deliberately nothing else here. An earlier version opened a modal
 * with numbered "open your browser menu, choose Install" instructions whenever
 * no prompt was available — which is exactly the moment it was least useful,
 * because the user had just tapped a button expecting the app to arrive and
 * was handed homework instead. No guide, no platform detection, no fallback
 * copy: the button either installs the app or does nothing visible.
 *
 * The one piece of real work is the wait. Chrome does not fire
 * `beforeinstallprompt` until the service worker has installed, activated and
 * taken control of the page, so on a first visit the prompt genuinely does not
 * exist yet at the moment of the tap. Rather than declaring failure, the click
 * waits for the worker to be ready and for the browser to make up its mind
 * (see `waitForInstallPrompt`), which is what turns a silent no-op into an
 * actual install.
 *
 * Nothing here can override a browser that has decided against installing. If
 * the platform has no install API — iOS is the case that matters — the tap
 * ends quietly. That is a browser rule, not something a button can override.
 */
export function InstallAppButton({
  className,
  label = 'Install Vidnov App',
}: {
  className?: string;
  /**
   * Button text. Overridable because the same control appears in surfaces that
   * speak differently — a sidebar says "Install", a marketing section says
   * "Download the application" — while the behaviour behind it is identical.
   */
  label?: string;
}) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
  }, []);

  // Already installed: nothing to offer.
  if (isStandalone) return null;

  const handleInstall = async () => {
    if (isInstalling) return;
    setIsInstalling(true);
    try {
      await waitForInstallPrompt();
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleInstall}
      disabled={isInstalling}
      aria-busy={isInstalling}
      className={className}
    >
      {isInstalling ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
      ) : (
        <Smartphone className="mr-2 h-4 w-4 text-primary" />
      )}
      {label}
    </Button>
  );
}

export default InstallAppButton;