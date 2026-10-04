import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { MEDIA_ROOT, MEDIA_TMP_ROOT } from './config';

/**
 * Disk-space management + storage-protection mode for Vidnov.
 * The VPS must never be filled to 100% — we keep a safety reserve
 * and refuse large uploads when free space is dangerously low.
 */

/** Safety reserve: never let free disk drop below this (1.5 GiB). */
export const STORAGE_RESERVE_BYTES = 1.5 * 1024 * 1024 * 1024;

export type StorageMode = 'NORMAL' | 'STORAGE_PROTECTION';

export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  mediaBytes: number;
  tmpBytes: number;
  mediaCount: number;
  tmpCount: number;
  mode: StorageMode;
  threshold: string | null; // which threshold tripped, e.g. 'CRITICAL'
  reserveBytes: number;
}

async function dirSize(
  dir: string,
): Promise<{ bytes: number; count: number }> {
  let bytes = 0;
  let count = 0;
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes: 0, count: 0 };
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await dirSize(full);
      bytes += sub.bytes;
      count += sub.count;
    } else {
      try {
        const st = await fsp.stat(full);
        bytes += st.size;
        count += 1;
      } catch {
        // file vanished mid-scan — ignore
      }
    }
  }
  return { bytes, count };
}

/** Uses statfs for accurate total/used/free of the filesystem holding MEDIA_ROOT. */
async function diskStats(): Promise<{
  totalBytes: number;
  freeBytes: number;
}> {
  const statfs = (fsp as any).statfs ?? (fs as any).statfs;
  if (typeof statfs === 'function') {
    try {
      const s = await statfs.call(fsp, MEDIA_ROOT);
      const total = Number(s.blocks) * Number(s.bsize);
      const free = Number(s.bavail) * Number(s.bsize);
      return { totalBytes: total, freeBytes: free };
    } catch {
      // fall through to df fallback
    }
  }
  // Fallback: parse `df -B1 /var/lib/vidnov` (works on any Linux VPS)
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const { stdout } = await run('df', ['-B1', MEDIA_ROOT]);
  const lines = dfSafeParse(stdout);
  return lines[0] ?? { totalBytes: 0, freeBytes: 0 };
}

function dfSafeParse(stdout: string): { totalBytes: number; freeBytes: number }[] {
  return stdout
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        totalBytes: Number(parts[1]) || 0,
        freeBytes: Number(parts[3]) || 0,
      };
    })
    .filter((r) => r.totalBytes > 0);
}

let cachedStats: { at: number; stats: StorageStats } | null = null;
const STATS_TTL_MS = 15_000; // cache disk scans for 15s

export async function getStorageStats(): Promise<StorageStats> {
  if (cachedStats && Date.now() - cachedStats.at < STATS_TTL_MS) {
    return cachedStats.stats;
  }

  const { totalBytes, freeBytes } = await diskStats();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const [media, tmp] = await Promise.all([dirSize(MEDIA_ROOT), dirSize(MEDIA_TMP_ROOT)]);

  const { MEDIA_CONFIG } = await import('./config');
  const mode: StorageMode =
    usedPercent >= MEDIA_CONFIG.STORAGE_CRITICAL_PERCENT ? 'STORAGE_PROTECTION' : 'NORMAL';
  const threshold =
    usedPercent >= MEDIA_CONFIG.STORAGE_EMERGENCY_PERCENT
      ? 'EMERGENCY'
      : usedPercent >= MEDIA_CONFIG.STORAGE_CRITICAL_PERCENT
        ? 'CRITICAL'
        : usedPercent >= MEDIA_CONFIG.STORAGE_HIGH_PERCENT
          ? 'HIGH'
          : usedPercent >= MEDIA_CONFIG.STORAGE_WARNING_PERCENT
            ? 'WARNING'
            : null;

  const stats: StorageStats = {
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent,
    mediaBytes: media.bytes,
    tmpBytes: tmp.bytes,
    mediaCount: media.count,
    tmpCount: tmp.count,
    mode,
    threshold,
    reserveBytes: STORAGE_RESERVE_BYTES,
  };

  cachedStats = { at: Date.now(), stats };
  return stats;
}

export function clearStorageStatsCache() {
  cachedStats = null;
}

/** Effective free space for uploads = free minus the safety reserve. */
export function usableFreeBytes(stats: StorageStats): number {
  return Math.max(0, stats.freeBytes - stats.reserveBytes);
}

/**
 * Gate for accepting a new upload of `incomingBytes`.
 * Returns null when allowed, or a rejection reason.
 */
export function canAcceptUpload(
  stats: StorageStats,
  incomingBytes: number,
): string | null {
  if (stats.mode === 'STORAGE_PROTECTION') {
    if (stats.threshold === 'EMERGENCY') {
      return 'Storage emergency: uploads are temporarily disabled. Please try again later.';
    }
    // CRITICAL (90%): only allow small files that fit within the reserve.
    if (incomingBytes > 10 * 1024 * 1024) {
      return 'Storage critical: only small uploads are accepted right now.';
    }
  }
  if (incomingBytes > usableFreeBytes(stats)) {
    return 'Not enough free storage for this upload. Please try again later.';
  }
  return null;
}

/** Ensures the media + tmp directory trees exist (idempotent). */
export async function ensureMediaDirs(): Promise<void> {
  await fsp.mkdir(MEDIA_ROOT, { recursive: true });
  await fsp.mkdir(MEDIA_TMP_ROOT, { recursive: true });
}

/** Moves a finished file from tmp into its permanent location atomically. */
export async function promoteFile(tmpPath: string, destAbsPath: string): Promise<void> {
  await fsp.mkdir(path.dirname(destAbsPath), { recursive: true });
  // rename() is atomic on the same filesystem; fall back to copy+delete otherwise.
  try {
    await fsp.rename(tmpPath, destAbsPath);
  } catch {
    await fsp.copyFile(tmpPath, destAbsPath);
    await fsp.rm(tmpPath, { force: true });
  }
}

/** Deletes a stored media file (and its thumbnail) if it exists. */
export async function deleteStoredFiles(relPaths: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    relPaths
      .filter((p): p is string => !!p)
      .map(async (rel) => {
        const abs = path.join(MEDIA_ROOT, rel);
        await fsp.rm(abs, { force: true });
        // Clean up empty month dirs to avoid clutter
        try {
          const dir = path.dirname(abs);
          const rest = await fsp.readdir(dir);
          if (rest.length === 0) await fsp.rmdir(dir);
          const parent = path.dirname(dir);
          const restParent = await fsp.readdir(parent);
          if (restParent.length === 0) await fsp.rmdir(parent);
        } catch {
          // ignore
        }
      }),
  );
}
