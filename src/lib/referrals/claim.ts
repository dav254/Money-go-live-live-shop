'use client';

import { getSurfaceAuth } from '@/firebase/surface-auth';
import { normaliseReferralCode } from '@/lib/referrals/referral-code';

/**
 * Reports a signup referral to the server.
 *
 * Called from the signup page once an account exists — there is nothing to
 * attach a referral to before that, since the document records both the
 * referrer and the new user's uid.
 *
 * ## Why this never blocks or throws
 *
 * A rewards code is a nice-to-have attached to the tail of an account
 * creation. If the claim fails — offline, admin SDK unreachable, a bad code —
 * the account must still exist and the user must still land in the app. So
 * every failure path here resolves quietly and the caller carries on. The one
 * thing it will NOT do is silently swallow a code that was present but not
 * recorded: that returns `recorded: false` with a reason so signup can warn
 * the user that their invite did not register, rather than leaving them to
 * believe a referrer earned points that never arrived.
 *
 * The server resolves the code to a referrer itself; the referrer uid is never
 * sent from here, precisely because a client cannot be trusted to name who it
 * wants to credit.
 */

export interface ClaimResult {
  recorded: boolean;
  /** Why it was not recorded, when `recorded` is false. */
  reason?:
    | 'no-code'
    | 'self-referral'
    | 'unknown-code'
    | 'no-auth'
    | 'network'
    | 'server';
}

export async function claimSignupReferral(input: {
  code: string | null | undefined;
  name?: string;
  email?: string;
}): Promise<ClaimResult> {
  const code = normaliseReferralCode(String(input.code || ''));
  if (!code) return { recorded: false, reason: 'no-code' };

  // A fresh token: the ID token minted at account creation can be stale by the
  // time this runs, and the server rejects a bad one outright.
  //
  // `getSurfaceAuth()` and not the no-argument `getAuth()`: this runs right
  // after signup, and on the installed-app surface the account lives in the
  // NAMED `vidnov-app` instance while no-arg `getAuth()` resolves against
  // `[DEFAULT]` (the website's app) — whose `currentUser` is null here. That
  // returned a false `no-auth` for every referral claimed inside the app, so
  // the signup page showed "Invite code not applied" even when nothing was
  // wrong with the code.
  let token: string;
  try {
    const user = getSurfaceAuth().currentUser;
    if (!user) return { recorded: false, reason: 'no-auth' };
    token = await user.getIdToken(true);
  } catch {
    return { recorded: false, reason: 'no-auth' };
  }

  try {
    const res = await fetch('/api/referrals/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, name: input.name, email: input.email }),
    });

    if (!res.ok) return { recorded: false, reason: 'server' };
    const data = (await res.json()) as ClaimResult;
    return data ?? { recorded: false, reason: 'server' };
  } catch {
    return { recorded: false, reason: 'network' };
  }
}

/** Wording for a code that was present but did not register. */
export function claimFailureMessage(reason: ClaimResult['reason']): string | null {
  switch (reason) {
    case 'self-referral':
      return 'You cannot use your own invite code.';
    case 'unknown-code':
      return 'That invite code was not recognised, so no referral was recorded.';
    default:
      return 'We could not record your invite code. Ask your referrer to share it again.';
  }
}
