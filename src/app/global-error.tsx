'use client';

/**
 * Global error boundary (App Router).
 *
 * Handles the dev-mode ChunkLoadError: when the dev server restarts
 * (memory threshold), previously emitted webpack chunks vanish and an
 * already-open browser tab fails to load them. This boundary detects
 * that case and reloads the page ONCE to fetch the fresh chunks.
 * A sessionStorage guard prevents reload loops.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    typeof error?.message === 'string' &&
    (error.message.includes('ChunkLoadError') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('chunk'));

  if (isChunkError && typeof window !== 'undefined') {
    const key = 'gev-chunk-reload';
    const last = Number(sessionStorage.getItem(key) ?? 0);
    // Reload at most once every 10 seconds to avoid loops.
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
      return null;
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground font-medium">
            The app hit an unexpected error. Your data is safe — try again, or reload the page.
          </p>
          <button
            onClick={reset}
            className="h-12 px-8 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
