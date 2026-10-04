'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

/**
 * The one way to sign a user out.
 *
 * ## Why this exists
 *
 * There were six sign-out buttons and they disagreed about where to send
 * someone. The app shells and the two Account screens called
 * `signOut(auth)` and navigated nowhere, which left a signed-out user standing
 * on the screen they had just signed out of — deep inside `/app/seller/...`,
 * rendering a sign-in prompt with the whole section still behind it. The
 * website's user nav did the opposite: it pushed `/login`, which is a dead end
 * for someone who did not come here to sign in.
 *
 * Six call sites, six chances to forget the redirect, is the wrong shape for
 * one rule. So the rule lives here and every button calls it.
 *
 * ## Why home
 *
 * `/` is the only surface that is useful without a session. The app requires
 * one, so "sign out" cannot mean "go back to where you were" — it has to mean
 * a real landing page. That also matches the section rule the rest of the app
 * already follows: the app never hands a user to a website route as a
 * consolation prize.
 *
 * ## `replace`, not `push`
 *
 * Back must not walk a freshly signed-out user straight back into the private
 * screen they just left. That history entry is worse than a 404 — the route
 * still exists, so it renders a sign-in prompt *inside* the section layout.
 *
 * ## Deliberately not used for forced sign-outs
 *
 * `surface-boundary` and the two suspended-account checks in the login flow
 * also call `signOut`, and none of them may navigate: they fire as a reaction
 * to the auth state they just caused, so navigating would fight their own
 * screen. Those stay as plain `signOut` calls. This hook is only for a user
 * who pressed a button.
 */
export function useSignOutToHome(auth: Auth | null | undefined): () => void {
  const router = useRouter();

  return useCallback(() => {
    // Navigate even when sign-out fails. A network error must not strand the
    // user on a private screen, and a session that failed to clear is the
    // smaller problem of the two.
    const done = () => router.replace('/');
    if (!auth) {
      done();
      return;
    }
    void signOut(auth).catch(() => {}).then(done, done);
  }, [auth, router]);
}