/**
 * Dev launcher / supervisor.
 *
 * Starts `next dev` with the same flags as before (same output, signals
 * forwarded) and pre-compiles the homepage once the port accepts connections,
 * so the first request after a restart does not pay the full cold-compile cost
 * (~10-16s here) — long enough for an external readiness check to give up on a
 * perfectly healthy server.
 *
 * ## Why this supervises instead of just spawning
 *
 * `next dev` holds every route it has ever compiled in memory: in this repo
 * `/dashboard/seller/analytics` alone pulls ~5.5k webpack modules, and the
 * module graph is never released. On a 2 GB box that adds up, and a single
 * heavy compile can spike V8 past `--max-old-space-size` *before* Next's own
 * "approaching the used memory threshold" restart gets a chance to run between
 * requests. When that happens the child dies with:
 *
 *     FATAL ERROR: Ineffective mark-compacts near heap limit
 *     Allocation failed - JavaScript heap out of memory
 *
 * The original launcher did `child.on('exit', () => process.exit(code))`, so
 * that crash took the whole dev server down with it and the preview reported a
 * failed start — for a condition that is entirely recoverable by starting the
 * server again.
 *
 * So the launcher now supervises: an unexpected exit is respawned with a short
 * backoff. The symptom becomes a couple of seconds of latency instead of a dead
 * preview, and the buyer-facing behaviour is unchanged.
 *
 * A respawn is capped (`MAX_RESPAWNS` within `RESPAWN_WINDOW_MS`) so a genuine
 * misconfiguration — a bad env var, a compile error on boot — surfaces
 * immediately instead of hiding behind an infinite crash loop.
 *
 * ## Why a port conflict is NOT retried
 *
 * The cap is the right answer for an OOM, because an OOM clears itself. A busy
 * port does not: if something else already holds it, all eight retries fail
 * identically, which is how a preview restart turned into a two-minute wall of
 * identical `EADDRINUSE` traces ending in a dead server. So a busy port is
 * checked before spawning and recognised in the child's output, and either one
 * exits immediately with a message naming the actual cause.
 *
 * The child's stderr is piped for that reason instead of inherited, and is
 * written straight back out on every chunk, so the dev log is unchanged.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';

const PORT = process.env.PORT || '3000';
const ORIGIN = `http://127.0.0.1:${PORT}`;
/** The route a readiness/health probe hits first — always warmed. */
const WARM_ROUTES = ['/'];
/** Opt-in extras: `/login,/dashboard/seller` (comma separated). */
const EXTRA_ROUTES = (process.env.WARM_ROUTES_EXTRA || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

/** Respawn policy — generous enough to ride out an OOM, tight enough to surface a real fault. */
const MAX_RESPAWNS = Number(process.env.DEV_MAX_RESPAWNS || 8);
const RESPAWN_WINDOW_MS = Number(process.env.DEV_RESPAWN_WINDOW_MS || 120_000);
const RESPAWN_DELAY_MS = Number(process.env.DEV_RESPAWN_DELAY_MS || 1500);

const launcherHeapMb = () => Math.round(process.memoryUsage().rss / (1024 * 1024));

/** RSS of the `next-server` worker (the process that actually holds memory). */
function serverRssMb() {
  try {
    const pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
    for (const pid of pids) {
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (!cmd.includes('next-server')) continue;
        const status = readFileSync(`/proc/${pid}/status`, 'utf8');
        const m = /VmRSS:\s+(\d+) kB/.exec(status);
        if (m) return Math.round(Number(m[1]) / 1024);
      } catch {
        // process vanished between readdir and read
      }
    }
  } catch {
    // /proc unavailable (non-Linux) — memory reporting is best-effort only
  }
  return null;
}

/** True once we have asked the child to stop, so its exit is not "unexpected". */
let stopping = false;
/** Timestamps of recent respawns, used to detect a crash loop. */
const respawns = [];
let child = null;

/**
 * Rolling tail of the child's stderr, used only to recognise a failure mode.
 *
 * This supervisor exists to ride out an OOM, and an OOM looks exactly like any
 * other unexpected exit — so the exit handler cannot tell "recoverable, retry"
 * from "this will never succeed". `EADDRINUSE` is the case that matters: when
 * something else already holds the port, retrying eight times over two minutes
 * produces a wall of identical stack traces and still ends in a dead preview.
 * The port cannot free itself, so the retry is pure delay.
 */
let stderrTail = '';

function noteStderr(chunk) {
  // Forward first, always. stderr is piped rather than inherited purely so it
  // can be read here; if this write were conditional the dev log would vanish.
  process.stderr.write(chunk);

  stderrTail = (stderrTail + chunk.toString()).slice(-4000);
  if (stderrTail.includes('EADDRINUSE')) {
    console.error(
      '[dev] port ' + PORT + ' is already in use. Not retrying — another process ' +
        'holds it, so every further attempt would fail identically.',
    );
    console.error('[dev] free the port (or use `freebuff-preview restart`) and start again.');
    // Hard stop. Do NOT respawn, and do not kill the holder: it may be a
    // healthy server the platform intends to keep.
    stopping = true;
    if (child) child.kill('SIGTERM');
    process.exit(1);
  }
}

/** True if something is already listening on the preview port. */
function portInUse() {
  return new Promise((resolve) => {
    const socket = connect({ port: Number(PORT), host: '127.0.0.1' });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    // Never let a probe hang the launcher.
    setTimeout(() => done(false), 1000);
  });
}

function startChild() {
  child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '--hostname', '0.0.0.0'],
    // stderr is piped rather than inherited so it can be inspected, then
    // written straight through — output and ordering are unchanged.
    { stdio: ['inherit', 'inherit', 'pipe'], env: process.env },
  );

  child.stderr?.on('data', noteStderr);

  child.on('exit', (code, signal) => {
    if (stopping) {
      // We asked for this. Mirror the child's fate and let the wrapper close.
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
      return;
    }

    // Next.js restarts its own worker on the 80% memory threshold; the exit
    // code is still 0 in that case, so it never reaches here. Anything that
    // does is a hard failure (most often the V8 OOM above).
    stderrTail = '';
    const now = Date.now();
    respawns.push(now);
    while (respawns.length && now - respawns[0] > RESPAWN_WINDOW_MS) {
      respawns.shift();
    }

    if (respawns.length > MAX_RESPAWNS) {
      console.error(
        `[dev] next dev exited ${MAX_RESPAWNS} times within ` +
          `${RESPAWN_WINDOW_MS / 1000}s — giving up rather than crash-looping.`,
      );
      console.error('[dev] the most likely causes are a compile error or a missing env var.');
      process.exit(code || 1);
      return;
    }

    console.warn(
      `[dev] next dev exited unexpectedly (code=${code} signal=${signal ?? 'none'}) — ` +
        `restarting in ${RESPAWN_DELAY_MS}ms ` +
        `(attempt ${respawns.length}/${MAX_RESPAWNS}, launcher ${launcherHeapMb()} MB)`,
    );
    setTimeout(() => {
      if (!stopping) startChild();
    }, RESPAWN_DELAY_MS);
  });
}

/** Waits for the port to accept connections, then pre-compiles key routes. */
async function warmUp() {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      // Any HTTP answer means the server is up (the compile happens during it).
      await fetch(`${ORIGIN}/`, { redirect: 'manual' });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const routes = [...WARM_ROUTES, ...EXTRA_ROUTES];
  console.log(`[dev] server is accepting connections — pre-compiling ${routes.join(', ')}`);
  for (const route of routes) {
    try {
      const started = Date.now();
      await fetch(`${ORIGIN}${route}`, { redirect: 'manual' });
      const rss = serverRssMb();
      console.log(
        `[dev] pre-compiled ${route} in ${((Date.now() - started) / 1000).toFixed(1)}s` +
          (rss ? ` (next-server rss ${rss} MB, launcher ${launcherHeapMb()} MB)` : ''),
      );
    } catch {
      // best-effort: a failed warm-up never blocks the dev server
    }
  }
  console.log('[dev] warm-up complete.');
}

/**
 * Start, but only if the port is actually free.
 *
 * Catching this before spawning turns a two-minute crash loop into one clear
 * line. It is a race either way — another server could bind a moment later —
 * which is exactly why `EADDRINUSE` is ALSO watched for in the child's output.
 */
async function main() {
  if (await portInUse()) {
    console.error(
      '[dev] port ' + PORT + ' is already in use — refusing to start a second dev server.',
    );
    console.error('[dev] free the port (or use `freebuff-preview restart`) and start again.');
    process.exit(1);
    return;
  }
  startChild();
  void warmUp();
}

void main();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    if (child) child.kill(signal);
  });
}