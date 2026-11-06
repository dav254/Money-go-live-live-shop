import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFor } from './api';

/**
 * One async-resource hook for every screen.
 *
 * Handles the three states a mobile list always has (loading, error, data),
 * aborts stale requests when the screen unmounts or the query changes, and
 * keeps the last good data visible during a retry so a pull-to-refresh does
 * not blank the screen.
 */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (!alive || controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((thrown) => {
        if (!alive || controller.signal.aborted) return;
        setError(messageFor(thrown));
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, error, loading, reload, setData };
}

/** Debounce free-text input before it becomes a network query. */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
