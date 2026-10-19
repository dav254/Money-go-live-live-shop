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
 * Download/install button: one tap, and the browser installs the app.
 *
 * The happy path is unchanged — tap, the browser's own install flow takes
 * over, done. The two things this version adds are both about the promise the
 * label makes ("Download the application"):
 *
 *   1. FAILURE IS NO LONGER SILENT. `promptInstall()` can reject (Chrome
 *      throws InvalidStateError if a prompt is already pending) and it returns
 *      null whenever the browser has no install API at all — iOS is the case
 *      that matters. Either way the user used to be left staring at an
 *      unchanged button. Now the tap resolves into a short, inline, platform-
 *      specific instruction (iOS: Share → Add to Home Screen; everywhere else:
 *      the browser menu's "Install app"), so the button always hands the user
 *      a working route to the app instead of homework with no context or
 *      nothing at all.
 *
 *   2. The hint only appears AFTER a tap found no prompt — never before, so
 *      the normal Chrome install path stays visually clean — and it clears
 *      again as soon as the browser does show a prompt (the user either
 *      installs or explicitly declines; neither needs the hint).
 *
 * The wait itself lives in `waitForInstallPrompt` and is bounded: Chrome does
 * not fire `beforeinstallprompt` until the service worker has installed,
 * activated and taken control, so the tap waits for that rather than failing
 * on the first miss.
 *
 * Nothing here can override a browser that has decided against installing on
 * its own. The fallback covers what a button genuinely cannot trigger.
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
  const [hint, setHint] = useState<string | null>(null);

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
      const outcome = await promptInstall();
      if (outcome === null) {
        setHint(noPromptHint());
      } else {
        // The browser showed its prompt: accepted or declined, the hint is
        // no longer useful either way.
        setHint(null);
      }
    } catch {
      // prompt() threw (typically a prompt already pending from an earlier
      // tap). Treat it the same as "no usable prompt": say what to do next
      // instead of dying as an unhandled rejection.
      setHint(noPromptHint());
    } finally {
      setIsInstalling(false);
    }
  };

  const button = (
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

  if (!hint) return button;

  return (
    <div className="flex w-full flex-col gap-2">
      {button}
      <p className="text-[11px] font-medium leading-snug text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** True for iOS/iPadOS, where there is no install API — only Share → Home. */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS masquerades as macOS but reports a multi-touch digitizer.
    (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua))
  );
}

/**
 * The direct route to the app when the browser exposes no install prompt.
 * Wording is platform-specific because the gesture genuinely differs.
 */
function noPromptHint(): string {
  return isAppleMobile()
    ? 'No install option here? Tap the Share button, then "Add to Home Screen" — Vidnov installs like an app.'
    : 'This browser offers no one-tap install. Open its menu and choose "Install app" (or "Add to Home Screen") to download Vidnov.';
}

export default InstallAppButton;
