'use client'

import type { User } from 'firebase/auth'

export interface UploadProgress {
  phase: 'uploading' | 'ready' | 'failed'
  percent: number
  url?: string
  thumbnailUrl?: string
  error?: string
}

export interface UploadHandle {
  mediaId: string
  promise: Promise<UploadProgress>
  phase?: UploadProgress['phase']
  url?: string
  thumbnailUrl?: string
  error?: string
}

export interface UploadOwnership {
  requestId?: string
  offerId?: string
  postId?: string
  folder?: string
}

/**
 * Polls /api/media/status until the background processor reports READY or
 * FAILED. The upload endpoint returns a mediaId right away (the heavy WebP /
 * H.264 work happens off the request), so without this poll the client would
 * resolve with no URL and the form would report "Media processing failed".
 */
async function pollUntilReady(
  mediaId: string,
  token: string,
  report: (p: UploadProgress) => void,
): Promise<UploadProgress> {
  const MAX_ATTEMPTS = 120 // ~2 min ceiling for slow transcodes
  const INTERVAL_MS = 1000

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS))

    let status: {
      status?: string
      url?: string
      thumbnailUrl?: string
      error?: string
      retryable?: boolean
    } = {}
    try {
      const res = await fetch(`/api/media/status?id=${encodeURIComponent(mediaId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 503) continue // transient backend load — back off and retry
      status = (await res.json()) as typeof status
    } catch {
      continue // network blip — keep polling
    }

    if (status.status === 'READY' && status.url) {
      return {
        phase: 'ready',
        percent: 100,
        url: status.url,
        thumbnailUrl: status.thumbnailUrl,
      }
    }
    if (status.status === 'FAILED') {
      return {
        phase: 'failed',
        percent: 100,
        error: status.error || 'Media processing failed.',
      }
    }

    // Still UPLOADING / PROCESSING — show indeterminate progress and keep waiting.
    report({ phase: 'uploading', percent: 95 })
  }

  return {
    phase: 'failed',
    percent: 100,
    error: 'Media processing timed out. Please try again.',
  }
}

/**
 * Shrinks a photo IN THE BROWSER before it travels — the single biggest
 * upload-speed lever there is.
 *
 * A phone camera sends 4–10MB JPEGs; the server re-encodes every image to
 * WebP anyway (see /api/media/upload → engine intake), so shipping the
 * original bytes buys nothing but wait time. This scales the image down to
 * MAX_UPLOAD_DIMENSION px on its longest edge and encodes WebP at q85 —
 * typically 150–400KB — which is why an 8-photo listing goes from minutes to
 * seconds on a phone connection.
 *
 * Never throws and never makes things worse: any failure (old browser,
 * undecodable file, GIF animation that must keep playing, or a compressed
 * result that somehow came out LARGER) returns the original file untouched.
 */
const MAX_UPLOAD_DIMENSION = 2048
const WEBP_QUALITY = 0.85

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // Animated GIFs would lose their animation as a single WebP frame.
  if (file.type === 'image/gif') return file
  // Small enough already — skip the decode/encode round trip entirely.
  if (file.size <= 300 * 1024) return file

  try {
    let bitmap: ImageBitmap
    try {
      // from-image honours EXIF orientation, so a portrait photo taken on a
      // phone is not uploaded sideways.
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      bitmap = await createImageBitmap(file)
    }

    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    // Below the server's own ceiling AND already small — nothing to gain.
    if (scale === 1 && file.size <= 1024 * 1024) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    )
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

export function uploadMedia(
  file: File,
  user: User | null,
  onProgress?: (p: UploadProgress) => void,
  ownership?: UploadOwnership,
): UploadHandle {
  const report = (p: UploadProgress) => onProgress?.(p)

  const handle: UploadHandle = {
    mediaId: '',
    promise: Promise.resolve({ phase: 'ready', percent: 100 } as UploadProgress),
    phase: 'uploading',
  }

  const fail = (
    resolve: (p: UploadProgress) => void,
    message: string,
  ) => {
    const error: UploadProgress = { phase: 'failed', percent: 100, error: message }
    report(error)
    handle.phase = 'failed'
    handle.error = message
    resolve(error)
  }

  handle.promise = new Promise<UploadProgress>((resolve) => {
    ;(async () => {
      try {
        if (!user) {
          fail(resolve, 'You must be signed in to upload media.')
          return
        }

        let token = await user.getIdToken()
        if (!token) {
          fail(resolve, 'You must be signed in to upload media.')
          return
        }

        const mediaId = crypto.randomUUID()
        handle.mediaId = mediaId
        report({ phase: 'uploading', percent: 0 })

        // Photos shrink in the browser first — a 6MB camera JPEG becomes
        // ~250KB before it ever touches the network.
        const payload = file.type.startsWith('image/')
          ? await compressImageForUpload(file)
          : file

        const form = new FormData()
        form.append('file', payload)
        if (ownership?.postId) form.append('postId', ownership.postId)
        if (ownership?.requestId) form.append('requestId', ownership.requestId)
        if (ownership?.offerId) form.append('offerId', ownership.offerId)
        if (ownership?.folder) form.append('folder', ownership.folder)

        /*
         * Photos upload one after another, so ONE transient network failure
         * used to kill the whole batch with "Failed to fetch" — which is what
         * a server restart (the dev RSS recycle) or a mobile radio blip looks
         * like from here. Retry the REQUEST: dropped connections and 5xx
         * (restart mid-flight) are transient; 4xx answers (too large, wrong
         * type, unauthorized, quota) are final and are never retried.
         *
         * Instead of guessing a backoff schedule, each retry first WAITS FOR
         * THE SERVER TO ANSWER AGAIN (a cheap probe of an endpoint that always
         * exists), so the pause is exactly as long as the outage instead of
         * being shorter than it. The whole loop runs under a hard 180s
         * deadline: a restart window is ~20s but the recompiles after it can
         * take 15-30s each on a small box, so a 90s budget could expire while
         * the server was healthy but rebuilding itself — which is what sellers
         * saw as "waited 90 seconds" on a photo that never actually failed.
         */
        /*
         * Photos are compressed to a few hundred KB before this loop, so a
         * 3-minute rescue window on one is pure punishment — the seller stares
         * at a stuck bar for minutes when the honest answer arrives in one.
         * Videos keep the long window: a 500MB upload legitimately takes
         * minutes and deserves the restart-survival retry.
         */
        const DEADLINE_MS = file.type.startsWith('image/') ? 60_000 : 180_000
        const startedAt = Date.now()
        let res: Response | null = null
        let lastError: unknown = null

        /**
         * True once ANY HTTP answer arrives — even a 401 — which is the only
         * reliable way to tell "port accepting again" from "still dead". The
         * probe is intentionally unauthenticated and never POSTs a body.
         */
        const serverIsUp = async () => {
          try {
            const probe = await fetch('/api/app-config', { cache: 'no-store' })
            return probe.status > 0
          } catch {
            return false
          }
        }

        const waitForServer = async (deadline: number) => {
          while (Date.now() < deadline) {
            if (await serverIsUp()) return true
            await new Promise((done) => setTimeout(done, 800))
          }
          return false
        }

        let attempt = 0
        let tokenRefreshed = false
        for (;;) {
          attempt++
          try {
            const next = await fetch('/api/media/upload', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            })
            /*
             * A 401 is usually an ID token that expired while the seller was
             * filling out a long form (or one the server could not verify
             * under load) — not an upload the user is barred from making.
             * Force-refresh the token once and retry instead of surfacing
             * "Unauthorized" for the video/photo they are entitled to upload.
             */
            if (next.status === 401 && !tokenRefreshed) {
              tokenRefreshed = true
              token = await user.getIdToken(true)
              continue
            }
            if (next.ok || next.status < 500) {
              res = next
              break
            }
            lastError = new Error(`The server returned ${next.status}.`)
          } catch (err) {
            lastError = err // "Failed to fetch" — the connection dropped
          }

          const elapsed = Date.now() - startedAt
          if (elapsed >= DEADLINE_MS) break

          // Creep towards (never past) 85%: the last stretch is the server's
          // own processing, and a bar past 100% reads as "done" while we wait.
          report({
            phase: 'uploading',
            percent: Math.min(85, Math.round((elapsed / DEADLINE_MS) * 80) + 5),
          })
          await waitForServer(Math.min(startedAt + DEADLINE_MS, Date.now() + 25_000))
          // A live server that answers 5xx in a loop must not be hammered.
          await new Promise((done) => setTimeout(done, Math.min(3000, 700 * attempt)))
        }

        if (!res) {
          const raw = lastError instanceof Error ? lastError.message : ''
          const looksLikeNetwork =
            !raw ||
            raw === 'Failed to fetch' ||
            raw === 'NetworkError when attempting to fetch resource.'
          // The photos that already landed keep their URLs (their slots are
          // cleared as they finish), so say so: Continue resumes the batch
          // instead of starting over.
          const waited = Math.round(DEADLINE_MS / 60_000)
          throw new Error(
            looksLikeNetwork
              ? `Could not reach the server — it may have been restarting (waited ${waited} minute${waited === 1 ? '' : 's'}). Photos already uploaded are kept; tap Continue to send the rest.`
              : `${raw.replace(/\.$/, '')} — photos already uploaded are kept; tap Continue to try again.`,
          )
        }

        let data: {
          mediaId?: string
          url?: string
          thumbnailUrl?: string
          error?: string
          message?: string
        } = {}
        try {
          data = (await res.json()) as typeof data
        } catch {
          /* ignore non-JSON body */
        }

        if (!res.ok || !data.mediaId) {
          const detail =
            typeof data?.error === 'string'
              ? data.error
              : typeof data?.message === 'string'
                ? data.message
                : `Server rejected the upload (${res.status}).`
          throw new Error(detail || 'Server rejected the upload.')
        }

        handle.mediaId = data.mediaId
        report({ phase: 'uploading', percent: 90 })

        // Images and raw files are processed synchronously and come back with a
        // final URL already — resolve immediately, no polling. Only videos are
        // transcoded in the background (no url yet), so only those poll.
        if (data.url) {
          const done: UploadProgress = {
            phase: 'ready',
            percent: 100,
            url: data.url,
            thumbnailUrl: data.thumbnailUrl,
          }
          report(done)
          handle.phase = done.phase
          handle.url = done.url
          handle.thumbnailUrl = done.thumbnailUrl
          resolve(done)
          return
        }

        // Async video: poll the disk-backed status endpoint until READY.
        const final = await pollUntilReady(data.mediaId, token, report)
        report(final)
        handle.phase = final.phase
        handle.url = final.url
        handle.thumbnailUrl = final.thumbnailUrl
        if (final.phase === 'failed') handle.error = final.error
        resolve(final)
      } catch (err) {
        fail(resolve, err instanceof Error ? err.message : 'Upload failed.')
      }
    })()
  })

  return handle
}
