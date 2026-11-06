import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from './auth';
import { useResource } from './use-resource';

/**
 * A resource that needs a signed-in bearer token.
 *
 * Two things happen here that a plain `useResource` would get wrong:
 *   - the loader is only enabled once the session is restored, so a cold start
 *     does not fire six requests with no token and render six 401 errors;
 *   - `getToken()` refreshes an expiring ID token first, so a screen opened
 *     after an hour of backgrounding still works instead of failing silently.
 */
export function useAuthedResource<T>(
  loader: (token: string) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
) {
  const { status, getToken } = useAuth();
  return useResource<T>(
    async () => {
      const token = await getToken();
      return loader(token);
    },
    [status, ...deps],
    { enabled: (options.enabled ?? true) && status === 'signedIn' },
  );
}

/** Live connectivity, for the offline banner and the retry affordances. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while the first probe is in flight —
      // treat that as "still online" rather than flashing an offline banner.
      const reachable = state.isInternetReachable;
      setOnline(state.isConnected !== false && reachable !== false);
    });
    return () => unsubscribe();
  }, []);

  return online;
}
