'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser, useUserProfile } from '@/firebase';
import { resolveRole, type AppRole } from '@/lib/auth/roles';
import {
  canRoleUseSection,
  isSectionEnabled,
  sectionForConsumerPath,
  type AppSection,
  type SectionToggles,
} from '@/lib/app-sections';

/**
 * Reads the admin-controlled section toggles for the signed-in user.
 *
 * Deliberately fetches from /api/app-config rather than subscribing to
 * Firestore: buyer/seller clients have no business reading the admin config
 * collection, and one small request on load is cheaper than a live listener
 * that only changes when an admin saves.
 *
 * Failures resolve to an empty toggle map, which `isSectionEnabled` treats as
 * "everything on" — a config problem must never lock users out of the app.
 */

/**
 * One shared request for the whole page.
 *
 * Every sidebar entry is wrapped in its own `SectionNavItem`, and each of those
 * calls this hook independently — so a sidebar with a dozen entries fired a
 * dozen identical requests to /api/app-config, each one re-verifying the caller's
 * token. On the seller sidebar that was twelve concurrent requests, and in dev
 * (where each one pays a fresh compile plus the token check) they took about six
 * seconds apiece. It was pure duplicated work competing with the page's own
 * render, and on a memory-constrained box it added real pressure during startup.
 *
 * The promise is cached module-wide for a short window: concurrent callers
 * share the in-flight request, and later callers reuse the result rather than
 * asking again. The TTL is short because toggles only change when an admin
 * saves, and a reload picks up a fresh one anyway.
 */
const CACHE_TTL_MS = 30_000;

/**
 * Cached per user id, so signing in as somebody else cannot inherit the
 * previous account's toggles, and so a signed-out → signed-in transition can
 * never serve a stale entry.
 */
let cached: { uid: string; promise: Promise<SectionToggles>; at: number } | null = null;

function fetchSectionToggles(uid: string): Promise<SectionToggles> {
  if (cached && cached.uid === uid && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = (async (): Promise<SectionToggles> => {
    try {
      const res = await fetch('/api/app-config', { cache: 'no-store' });
      if (!res.ok) return {};
      const data = (await res.json()) as { sections?: SectionToggles };
      return data.sections ?? {};
    } catch {
      return {};
    }
  })();

  cached = { uid, promise, at: Date.now() };
  return promise;
}

export function useAppSections() {
  const { user } = useUser();
  const uid = user?.uid;
  const { userProfile } = useUserProfile(user?.uid);
  const [toggles, setToggles] = useState<SectionToggles>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const role = resolveRole(userProfile);

  const load = useCallback(async () => {
    if (!uid) return;
    setToggles(await fetchSectionToggles(uid));
    setIsLoaded(true);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
  }, [uid, load]);

  const consumerRole: AppRole | null = role === 'buyer' || role === 'seller' ? role : null;

  return {
    toggles,
    isLoaded,
    /** Admins are never governed by the consumer registry. */
    isGoverned: consumerRole !== null,
    role: consumerRole,
    isEnabled: (id: string) => isSectionEnabled(toggles, id),
    canUse: (section: AppSection) => canRoleUseSection(section, consumerRole, toggles),
    sectionForPath: (pathname: string) => sectionForConsumerPath(pathname),
  };
}