import * as path from 'path'
import { db } from '@/firebase/server'
import { MEDIA_COLLECTION, MEDIA_ROOT } from '@/lib/media/config'
import { getStorageAdapter } from '@/lib/media/storage-adapter'
import type { MediaRecord } from './service'

/**
 * Storage cleanup for the images section of the VPS media root.
 *
 * This backend helper scans the images folder, finds stored files that are
 * not referenced by any READY media record in Firestore, and removes them.
 * It never touches:
 *  - files that still have a READY DB record
 *  - the tmp directory
 *  - request/offer private media
 *
 * The old wire section of /api/media/storage (which reported images/videos/
 * thumbnails/files subfolder sizes and largest files) has been removed in
 * favour of this dedicated cleanup implementation.
 */

export interface CleanupResult {
  removed: number
  reclaimedBytes: number
  errors: string[]
}

export async function cleanupOrphanedImages(): Promise<CleanupResult> {
  const result: CleanupResult = { removed: 0, reclaimedBytes: 0, errors: [] }
  const adapter = getStorageAdapter()

  try {
    const snap = await db.collection(MEDIA_COLLECTION).get()
    const referenced = new Set<string>()

    for (const doc of snap.docs) {
      const data = doc.data() as MediaRecord
      if (data.status !== 'READY' || !data.storagePath) continue
      referenced.add(path.resolve(MEDIA_ROOT, data.storagePath))
      if (data.thumbnailPath) {
        referenced.add(path.resolve(MEDIA_ROOT, data.thumbnailPath))
      }
    }

    const imagesDir = path.join(MEDIA_ROOT, 'images')
    await cleanupDir(imagesDir, referenced, adapter, result)
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function cleanupDir(
  dir: string,
  referenced: Set<string>,
  adapter: ReturnType<typeof getStorageAdapter>,
  result: CleanupResult,
): Promise<void> {
  let entries: string[]
  try {
    entries = await adapter.readdir(dir)
  } catch {
    return
  }

  for (const name of entries) {
    const abs = adapter.resolve(path.join(dir, name))
    if (referenced.has(abs)) continue

    try {
      const st = await adapter.stat(abs)
      if (!st) continue
      if (name.endsWith('/')) {
        await cleanupDir(abs, referenced, adapter, result)
        try {
          await adapter.removeTree(abs)
        } catch {
          // best effort
        }
        continue
      }
      await adapter.deleteFiles([abs])
      result.removed += 1
      result.reclaimedBytes += st.size
    } catch (error) {
      result.errors.push(`${abs}: ${String(error)}`)
    }
  }
}
