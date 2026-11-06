'use client';

import { useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  installBlocker,
  isRunningStandalone,
  promptInstall,
  subscribeInstallPrompt,
  waitForInstallPrompt,
  type InstallBlocker,
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
 *   3. CONTEXTS THAT CAN NEVER INSTALL ANSWER IMMEDIATELY. An embedded
 *      iframe (a site preview pane — Chrome will not fire the install event
 *      inside one) and a non-https address (no install API at all) are
 *      detected up front by `installBlocker()` and get their reason on
 *      screen the moment the section renders, plus a real way out: in a
 *      frame, the tap opens the same page in a full tab where install *      actually works. iOS never fires the event either, so it gets its
 *      Share → Add to Home Screen route up front instead of after a wait.
 *
 * Nothing here can override a browser that has decided against installing on
 * its own. The fallback covers what a button genuinely cannot trigger.
 */
export function InstallAppButton({
  className,
  iconClassName,
  label = 'Install Vidnov App',
}: {
  className?: string;
  /**
   * Icon colour. Defaults to the brand primary, which suits a light surface;
   * a solid brand-filled button needs the icon in the foreground colour instead.
   */
  iconClassName?: string;
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
  const [blocker, setBlocker] = useState<InstallBlocker | null>(null);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
    const found = installBlocker();
    setBlocker(found);
    if (found) {
      // Certainty, not a tap outcome: say why right away.
      setHint(found.message);
    } else if (isAppleMobile()) {
      // iOS never fires the install event — offer the gesture that works now
      // rather than waiting four seconds for a prompt that cannot exist.
      setHint(noPromptHint());
    }
    // A prompt that arrives AFTER a failed tap clears the hint, re-arming the
    // one-tap install (the behaviour this component's doc comment promises).
    return subscribeInstallPrompt((event) => {
      if (event) setHint(null);
    });
  }, []);

  // Already installed: nothing to offer.
  if (isStandalone) return null;

  const handleInstall = async () => {
    if (isInstalling) return;
    if (blocker?.kind === 'iframe') {
      // This frame can never install; a real tab can. Hand the user one.
      window.open(window.location.href, '_blank', 'noopener');
      return;
    }
    if (blocker) return; // insecure — the on-screen reason already explains it
    if (isAppleMobile()) {
      setHint(noPromptHint());
      return;
    }
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

  const iconTone = iconClassName ?? 'text-primary';

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
        <Loader2 className={`mr-2 h-4 w-4 animate-spin ${iconTone}`} />
      ) : (
        <Smartphone className={`mr-2 h-4 w-4 ${iconTone}`} />
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
