/**
 * APPLICATION SECTION + APP VIDEO STUDIO.
 * Run: npx tsx --test src/tests/app-download-studio.test.ts
 *
 * Two requests, both source-level honesty guards in the style of
 * video-studio.test.ts:
 *
 *   1. The application (download) section — the "Get the app" surface — is
 *      live: mounted on the buyer dashboard, and the install button answers
 *      immediately and honestly in every browsing context (iframe, insecure
 *      origin, iOS) instead of dead-ending.
 *   2. The CapCut-style video editor exists on the application surface: its
 *      route mounts the shared editor, is registered for the immersive
 *      full-screen shell, appears in the drawer, and is governed by the
 *      admin section toggle alongside the website copy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* ── 1. The application (download) section is live ─────────────────── */

describe('application section — download surface is live', () => {
  it('the buyer dashboard renders the Get the app section itself', () => {
    const page = read('src/app/buyer/dashboard/page.tsx');
    assert.ok(
      page.includes("from '@/components/buyer/buyer-app-hub'"),
      'BuyerAppHub must be imported, not left dead',
    );
    assert.ok(page.includes('<BuyerAppHub />'), 'the section must render on the dashboard');
  });

  it('the buyer hub and both sidebars still offer the install button', () => {
    const hub = read('src/components/buyer/buyer-app-hub.tsx');
    assert.ok(hub.includes('<InstallAppButton'), 'the Get the app section must offer install');
    for (const sidebar of [
      'src/components/buyer/buyer-sidebar.tsx',
      'src/components/seller/seller-sidebar.tsx',
    ]) {
      assert.ok(read(sidebar).includes('<InstallAppButton'), `${sidebar} must offer install`);
    }
  });

  it('the install button answers immediately in contexts that can never install', () => {
    const button = read('src/components/install-app-button.tsx');
    assert.ok(button.includes('installBlocker()'), 'iframe/secure contexts are detected up front');
    assert.ok(button.includes("blocker?.kind === 'iframe'"), 'an embedded frame gets its reason');
    assert.ok(
      button.includes('window.open(window.location.href'),
      'in a frame the tap opens a real tab where install can actually happen',
    );
    // The hint is not a tap-only outcome any more: a certified reason shows
    // on render, and iOS gets its Share route without waiting for a prompt
    // that can never exist on that platform.
    assert.ok(button.includes('setHint(found.message)'), 'the reason is shown on render');
    assert.ok(button.includes('isAppleMobile()'), 'iOS is routed to Add to Home Screen');
    assert.ok(button.includes('subscribeInstallPrompt'), 'a late-arriving prompt re-arms install');
  });

  it('the blockers live in the shared PWA library and cover frame + insecure origin', () => {
    const lib = read('src/lib/pwa-install.ts');
    assert.ok(lib.includes('export function installBlocker'), 'single source of truth');
    assert.ok(lib.includes('window.self !== window.top'), 'iframe detection');
    assert.ok(lib.includes('window.isSecureContext'), 'secure-context detection');
  });
});

/* ── 2. The CapCut-style editor on the application section ─────────── */

describe('application section — CapCut-style video studio', () => {
  const APP_ROUTE = 'src/app/app/seller/video-studio/page.tsx';

  it('the application route exists and mounts the shared editor, not a copy', () => {
    assert.ok(existsSync(join(ROOT, APP_ROUTE)), 'the app-surface editor route must exist');
    const page = read(APP_ROUTE);
    assert.ok(page.startsWith("'use client'"), 'client route');
    assert.ok(
      page.includes("from '@/components/studio/editor/editor'"),
      'one editor, imported — never forked per surface',
    );
    assert.ok(page.includes('<VideoEditorStudio />'));
    // Sized for the immersive shell: 3rem header + pb-2 → the content box is
    // the rest of the screen, so the timeline and toolbars use full height.
    assert.ok(page.includes('h-[calc(100vh-3.5rem)]'), 'fills the immersive content box');
    assert.ok(page.includes('overflow-hidden'), 'the editor owns its own scrolling');
  });

  it('the shell treats the route immersive and the drawer can reach it', () => {
    const shell = read('src/components/app/seller/seller-app-shell.tsx');
    assert.ok(
      shell.includes("'/app/seller/video-studio'"),
      'the route must be in IMMERSIVE_ROUTES (no tab bar over the timeline)',
    );
    const drawer = read('src/components/app/seller/seller-nav-drawer.tsx');
    assert.ok(drawer.includes("href: '/app/seller/video-studio'"), 'drawer entry required');
    assert.ok(drawer.includes('label: \'Video Studio\''), 'named like the website section');
  });

  it('the admin toggle governs both surfaces of the editor', () => {
    const sections = read('src/lib/app-sections.ts');
    assert.ok(
      sections.includes(
        "prefixes: ['/dashboard/seller/video-studio', '/app/seller/video-studio']",
      ),
      'one section, both prefixes — switching it off must not leave one surface alive',
    );
  });

  it('the editor never exits the application section to a website route', () => {
    const editor = read('src/components/studio/editor/editor.tsx');
    const closeFallback = editor.indexOf("pathname.startsWith('/app')");
    assert.ok(closeFallback > -1, 'the close fallback must recognise the app surface');
    const closeBlock = editor.slice(closeFallback, closeFallback + 260);
    assert.ok(
      closeBlock.includes("router.push('/app/seller')"),
      'cold start inside the app must land on the app section home',
    );
    // The website fallback sits AFTER the app check, so it can never win.
    const appCheck = editor.indexOf("window.location.pathname.startsWith('/app')");
    const webFallback = editor.indexOf("router.push('/seller/studio/record')");
    assert.ok(appCheck > -1 && webFallback > appCheck, 'app check must precede the website route');
  });
});
