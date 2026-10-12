'use client';

import * as React from 'react';

type Severity = 'log' | 'warn' | 'error';

const QUEUE_KEY = 'viderr-deferred-errors';
const FLUSH_ENDPOINT = '/api/error-log';

function enqueue(entry: { message: string; severity: Severity; timestamp: string }) {
  const queue = (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(QUEUE_KEY) : null;
      if (!raw) return [] as { message: string; severity: Severity; timestamp: string }[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  queue.push(entry);

  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    // ignore quota / private-mode failures; the queue is best-effort
  }
}

function drain(): { message: string; severity: Severity; timestamp: string }[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(QUEUE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const queue = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    return queue;
  } catch {
    return [];
  }
}

export function DeferredErrorLogger() {
  const [flushed, setFlushed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || flushed) return;
    const queue = drain();
    if (queue.length === 0) return;

    const body = {
      entries: queue.map((e) => ({
        severity: e.severity,
        message: e.message,
        timestamp: e.timestamp,
      })),
    };

    fetch(FLUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // best-effort; do not throw from the effect
    });

    setFlushed(true);
  }, [flushed]);

  return null;
}
