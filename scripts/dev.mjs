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

/**
 * Memory watchdog.
 *
 * `next dev` never releases a compiled route, so its RSS climbs for the life of
 * the process. On a ~2 GB box that ends in a hard V8 OOM:
 *
 *     FATAL ERROR: Ineffective mark-compacts near heap limit
 *
 * which the supervisor above respawns from — but the process still *died* first,
 * and the platform saw a dev server that exited and reported the preview as
 * failed to start. The symptom the user gets is "the dev server failed to
 * start", for a condition that is really "the server got old".
 *
 * So the same restart is done deliberately, early: once the worker sits above
 * the ceiling for two consecutive samples, recycle it while it is still healthy.
 * A restart the launcher asked for is not a crash, and must not spend the
 * crash-loop budget (see the exit handler) or a long session would eventually
 * give up on a server behaving exactly as designed.
 *
 * The default ceiling is tuned to this box, not guessed: the original hard OOM
 * landed with RSS around 1.5-1.6 GB, and the machine has ~1983 MB total with a
 * few hundred MB already spoken for. 1450 MB sits under the point where V8 dies
 * while leaving headroom for the kernel.
 *
 * It is deliberately NOT set lower. Too tight a ceiling does not prevent the
 * crash, it just replaces it: every recycle costs a full recompile of every
 * route (~15-20s each here), so a limit that trips a minute after boot makes the
 * dev server slower than the OOM it was meant to avoid.
 */
const RSS_LIMIT_MB = Number(process.env.DEV_RSS_LIMIT_MB || 1450);
const RSS_POLL_MS = Number(process.env.DEV_RSS_POLL_MS || 5_000);
const RSS_STRIKES = Number(process.env.DEV_RSS_STRIKES || 2);
/** Ignore a worker that just started: its cache is still warming, so RSS falls. */
const MIN_UPTIME_MS = Number(process.env.DEV_MIN_UPTIME_MS || 45_000);
/** How long to wait for our own dying worker to release the port on a recycle. */
const PORT_FREE_WAIT_MS = Number(process.env.DEV_PORT_FREE_WAIT_MS || 15_000);

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
/** True while we are deliberately recycling the worker (memory watchdog). */
let recycling = false;
/**
 * True only for the child that replaced a recycled one.
 *
 * That one child is racing our own dying worker for port 3000. The
 * EADDRINUSE guard below assumes a busy port belongs to somebody else and will
 * not clear — true in general, false here, since the holder is exiting on its
 * own within milliseconds. Treating that as fatal tore the whole preview down
 * the first time the watchdog fired.
 */
let pendingRecycle = false;
/**
 * True from the moment a child exits until its replacement is spawned.
 *
 * Without this the watchdog keeps ticking while the launcher is waiting for the
 * port to free: `child` still points at the dead process, `serverRssMb()` still
 * reports the draining one, and the watchdog kills the same worker twice. The
 * second kill then lands mid-respawn and the replacement loses the port race.
 */
let respawning = false;
/** When the current child was spawned, so the watchdog can ignore a warming one. */
let childStartedAt = 0;
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
    if (pendingRecycle) {
      console.error(
        '[dev] port still held by the worker we just recycled — tolerating it; ' +
          'the exit handler retries once the socket is released.',
      );
      return;
    }
    console.error(
      '[dev] port ' + PORT + ' is already in use. Not retrying — another process ' +
        'holds it, so every further attempt would fail identically.',
    );
    console.error('[dev] free the port (or use `freebuff-preview restart`) and start again.');
    // Hard stop. Do NOT respawn, and do not kill the holder: it may be a
    // healthy server the platform intends to keep.
    stopping = true;
    killChildTree('SIGTERM');
    process.exit(1);
  }
}

/**
 * Waits until our own dying worker has released the port.
 *
 * Only used after a planned recycle. A crashed child is gone immediately; a
 * SIGTERMed one keeps its listening socket until it finishes shutting down,
 * which on this box takes long enough to collide with its own replacement.
 */
async function waitForPortFree(maxMs) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    if (!(await portInUse())) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 300));
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

/**
 * Kills the worker AND the server it spawned.
 *
 * `npx next dev` does not run the dev server itself — it shells out to
 * `next-server` as a grandchild. Signalling only the wrapper leaves that
 * grandchild alive and still holding port 3000, which is why a recycle
 * followed by a respawn kept losing the port race: the log even shows requests
 * served *after* the SIGTERM. `detached: true` puts the child in its own
 * process group, and a negative pid signals the whole group.
 */
function killChildTree(signal) {
  if (!child || !child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

function startChild() {
  child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '--hostname', '0.0.0.0'],
    // stderr is piped rather than inherited so it can be inspected, then
    // written straight through — output and ordering are unchanged.
    // `detached` gives the child its own process group so the whole tree can be
    // signalled; see `killChildTree`.
    { stdio: ['inherit', 'inherit', 'pipe'], env: process.env, detached: true },
  );

  childStartedAt = Date.now();

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
    // does is a hard failure (most often the V8 OOM above) — or a recycle we
    // asked for, which must NOT count against the crash-loop budget.
const planned = recycling;
    recycling = false;
    pendingRecycle = planned;
    respawning = true;

    stderrTail = '';
    const now = Date.now();
    if (!planned) {
      respawns.push(now);
      while (respawns.length && now - respawns[0] > RESPAWN_WINDOW_MS) {
        respawns.shift();
      }
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
      `[dev] ${planned ? 'recycling next dev' : 'next dev exited unexpectedly'} ` +
        `(code=${code} signal=${signal ?? 'none'}) — ` +
        `restarting in ${RESPAWN_DELAY_MS}ms ` +
        `(attempt ${respawns.length}/${MAX_RESPAWNS}, launcher ${launcherHeapMb()} MB)`,
    );
    const spawnAgain = () => {
      if (stopping) return;
      startChild();
      respawning = false;
    };

    if (planned) {
      void waitForPortFree(PORT_FREE_WAIT_MS).then(spawnAgain);
    } else {
      // Still wait for the port. A crashed child frees it instantly so this is
      // a no-op, but the case that matters — a wrapper that exited while its
      // grandchild kept the socket — is exactly what this catches.
      setTimeout(() => void waitForPortFree(PORT_FREE_WAIT_MS).then(spawnAgain), RESPAWN_DELAY_MS);
    }
  });
}

/**
 * Recycle the worker before V8 runs out of heap.
 *
 * Two consecutive samples above the ceiling are required so a single spike
 * during one heavy compile does not cost a restart, and the uptime floor stops
 * the loop from restarting a server that has only just booted.
 */
function startMemoryWatchdog() {
  if (!(RSS_LIMIT_MB > 0)) return;
  let strikes = 0;

  const timer = setInterval(() => {
    if (stopping || recycling || respawning || !child) return;
    // The EADDRINUSE tolerance is only for the port-release window. Once this
    // child has outlived it, a busy port is somebody else's again.
    if (pendingRecycle && Date.now() - childStartedAt > PORT_FREE_WAIT_MS) {
      pendingRecycle = false;
    }
    if (Date.now() - childStartedAt < MIN_UPTIME_MS) {
      strikes = 0;
      return;
    }
    const rss = serverRssMb();
    if (rss === null) return;
    strikes = rss >= RSS_LIMIT_MB ? strikes + 1 : 0;
    if (strikes < RSS_STRIKES) return;

    strikes = 0;
    recycling = true;
    console.warn(
      `[dev] next-server rss ${rss} MB is at the ${RSS_LIMIT_MB} MB ceiling — ` +
        `recycling it while it is still healthy (free RAM would otherwise be ` +
        `what finally fails). Set DEV_RSS_LIMIT_MB=0 to disable.`,
    );
    killChildTree('SIGTERM');
  }, RSS_POLL_MS);

  // Never hold the launcher open on the timer alone.
  timer.unref?.();
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
  startMemoryWatchdog();
  void warmUp();
}

void main();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    // The whole tree, not just the `npx` wrapper — otherwise `next-server`
    // survives the launcher and keeps port 3000 bound.
    killChildTree(signal);
  });
}