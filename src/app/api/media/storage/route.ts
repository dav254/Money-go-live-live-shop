import { NextResponse } from 'next/server'
import { db } from '@/firebase/server'
import { MEDIA_COLLECTION, MEDIA_ROOT } from '@/lib/media/config'
import { getStorageAdapter } from '@/lib/media/storage-adapter'
import type { MediaRecord } from '@/lib/media/service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded: { uid?: string } = {}
  try {
    const { getAuth } = await import('firebase-admin/auth')
    decoded = await getAuth().verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!decoded.uid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const profile = await db.collection('userProfiles').doc(decoded.uid).get()
  if (!profile.exists || profile.data()?.userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const root = MEDIA_ROOT
  const adapter = getStorageAdapter()

  async function dirSize(dir: string): Promise<{ bytes: number; count: number }> {
    let bytes = 0
    let count = 0
    try {
      for (const name of await adapter.readdir(dir)) {
        const abs = adapter.resolve(`${dir}/${name}`)
        try {
          const st = await adapter.stat(abs)
          if (st) {
            bytes += st.size
            count += 1
          }
        } catch {
          // skip entries we cannot stat
        }
      }
    } catch {
      // directory may not exist yet
    }
    return { bytes, count }
  }

  async function subdirSizes(dir: string): Promise<{ bytes: number; count: number; subdirCount: number }> {
    let bytes = 0
    let count = 0
    let subdirCount = 0
    try {
      for (const name of await adapter.readdir(dir)) {
        const abs = adapter.resolve(`${dir}/${name}`)
        try {
          const st = await adapter.stat(abs)
          if (st) {
            bytes += st.size
            count += 1
          } else {
            subdirCount += 1
          }
        } catch {
          // skip entries we cannot stat
        }
      }
    } catch {
      // directory may not exist yet
    }
    return { bytes, count, subdirCount }
  }

  async function dirSizeRecursive(dir: string): Promise<{ bytes: number; count: number }> {
    let bytes = 0
    let count = 0
    try {
      for (const name of await adapter.readdir(dir)) {
        const abs = adapter.resolve(`${dir}/${name}`)
        try {
          const st = await adapter.stat(abs)
          if (st) {
            bytes += st.size
            count += 1
          } else {
            const sub = await dirSizeRecursive(abs)
            bytes += sub.bytes
            count += sub.count
          }
        } catch {
          // skip entries we cannot stat
        }
      }
    } catch {
      // directory may not exist yet
    }
    return { bytes, count }
  }

  try {    const [media, tmp] = await Promise.all([
      dirSizeRecursive(root),
      dirSizeRecursive('/var/lib/vidnov/tmp'),
    ])

    const snap = await db.collection(MEDIA_COLLECTION).get()
    let images = 0
    let videos = 0
    let thumbnails = 0
    let files = 0
    let mediaBytes = 0
    const largest: Array<{
      path: string
      sizeBytes: number
      bytes: number
      count: number
    }> = []

    for (const name of await adapter.readdir(root)) {
      const abs = adapter.resolve(`${root}/${name}`)
      try {
        const st = await adapter.stat(abs)
        if (!st) continue

        if (name === 'images' || name === 'videos' || name === 'thumbnails' || name === 'files') {
          const sub = await dirSizeRecursive(abs)
          if (name === 'images') {
            images += sub.count
            mediaBytes += sub.bytes
          }
          if (name === 'videos') {
            videos += sub.count
            mediaBytes += sub.bytes
          }
          if (name === 'thumbnails') {
            thumbnails += sub.count
            mediaBytes += sub.bytes
          }
          if (name === 'files') {
            files += sub.count
            mediaBytes += sub.bytes
          }
          largest.push({
            path: name,
            sizeBytes: sub.bytes,
            bytes: sub.bytes,
            count: sub.count,
          })
        }
      } catch {
        // skip unreadable entries
      }
    }

    largest.sort((a, b) => b.sizeBytes - a.sizeBytes)

    return NextResponse.json({
      totalBytes: media.bytes,
      usedBytes: media.bytes,
      freeBytes: 0,
      mediaCount: media.count,
      tmpCount: tmp.count,
      images,
      videos,
      thumbnails,
      files,
      mediaBytes,
      largestFiles: largest.slice(0, 10),
      mediaPath: root,
      tmpPath: '/var/lib/vidnov/tmp',
    })
  } catch (error) {
    console.error('[media/storage]', error)
    return NextResponse.json({ error: 'Failed to read storage stats.' }, { status: 500 })
  }
}
