import * as path from 'path';
import * as fsp from 'fs/promises';
import { MEDIA_ROOT } from './config';

/**
 * Storage abstraction (spec §35–36).
 *
 * The whole Vidnov app touches media through this interface — never through
 * raw filesystem paths. Today it is backed by the local VPS disk
 * (`/var/lib/vidnov/media`). When Vidnov outgrows the first server, a new
 * adapter (larger dedicated storage, NFS mount, object store) can be dropped
 * in here without rebuilding the marketplace.
 */

export interface StorageAdapter {
  readonly id: string;
  /** Resolve a relative storage path to something the adapter can read. */
  resolve(relPath: string): string;
  /** Ensure directories for a permanent destination exist. */
  ensureDir(absPath: string): Promise<void>;
  /** Write a buffer to a permanent location. Returns the absolute path. */
  writeBuffer(absPath: string, data: Buffer): Promise<void>;
  /** Atomically move a finished temp file into permanent storage. */
  moveFile(fromAbs: string, toAbs: string): Promise<void>;
  /** Read a stored file. Throws when missing. */
  readFile(absPath: string): Promise<Buffer>;
  /**
   * Read only bytes [start, end] (inclusive). Used for HTTP Range delivery so
   * a 1 KB range request never pulls the whole file into memory.
   */
  readSlice(absPath: string, start: number, end: number): Promise<Buffer>;
  /** Stat a stored file (null when missing). */
  stat(absPath: string): Promise<{ size: number; mtimeMs: number } | null>;
  /** Delete stored files (thumbnails included) — best effort. */
  deleteFiles(absPaths: (string | null | undefined)[]): Promise<void>;
  /** Delete a directory tree (tmp work dirs, empty request folders). */
  removeTree(absPath: string): Promise<void>;
  /** List immediate children of a directory. */
  readdir(absPath: string): Promise<string[]>;
}

/**
 * Local VPS disk adapter — the first storage environment.
 * All paths resolve inside MEDIA_ROOT; the resolve() guard doubles as the
 * traversal-protection primitive for delivery routes.
 */
class LocalVpsStorageAdapter implements StorageAdapter {
  readonly id = 'local-vps';

  resolve(relPath: string): string {
    const abs = path.resolve(MEDIA_ROOT, relPath);
    if (!abs.startsWith(path.resolve(MEDIA_ROOT))) {
      throw new Error('Storage path escapes media root');
    }
    return abs;
  }

  async ensureDir(absPath: string): Promise<void> {
    await fsp.mkdir(absPath, { recursive: true });
  }

  async writeBuffer(absPath: string, data: Buffer): Promise<void> {
    await this.ensureDir(path.dirname(absPath));
    await fsp.writeFile(absPath, data);
  }

  async moveFile(fromAbs: string, toAbs: string): Promise<void> {
    await this.ensureDir(path.dirname(toAbs));
    try {
      await fsp.rename(fromAbs, toAbs);
    } catch {
      // Cross-device rename falls back to copy+delete.
      await fsp.copyFile(fromAbs, toAbs);
      await fsp.rm(fromAbs, { force: true });
    }
  }

  async readFile(absPath: string): Promise<Buffer> {
    return fsp.readFile(absPath);
  }

  async readSlice(absPath: string, start: number, end: number): Promise<Buffer> {
    const length = Math.max(0, end - start + 1);
    const handle = await fsp.open(absPath, 'r');
    try {
      const buf = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buf, 0, length, start);
      return bytesRead === length ? buf : buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async stat(absPath: string): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const st = await fsp.stat(absPath);
      return { size: st.size, mtimeMs: st.mtimeMs };
    } catch {
      return null;
    }
  }

  async deleteFiles(absPaths: (string | null | undefined)[]): Promise<void> {
    await Promise.all(
      absPaths
        .filter((p): p is string => !!p)
        .map(async (abs) => {
          await fsp.rm(abs, { force: true }).catch(() => undefined);
        }),
    );
  }

  async removeTree(absPath: string): Promise<void> {
    await fsp.rm(absPath, { recursive: true, force: true }).catch(() => undefined);
  }

  async readdir(absPath: string): Promise<string[]> {
    try {
      return await fsp.readdir(absPath);
    } catch {
      return [];
    }
  }
}

let adapter: StorageAdapter | null = null;

/** The single storage adapter used by every media pipeline in the app. */
export function getStorageAdapter(): StorageAdapter {
  if (!adapter) adapter = new LocalVpsStorageAdapter();
  return adapter;
}

/** Test/advanced: swap the adapter at runtime (future large-server mode). */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}
