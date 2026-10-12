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

        const token = await user.getIdToken()
        if (!token) {
          fail(resolve, 'You must be signed in to upload media.')
          return
        }

        const mediaId = crypto.randomUUID()
        handle.mediaId = mediaId
        report({ phase: 'uploading', percent: 0 })

        const form = new FormData()
        form.append('file', file)
        if (ownership?.postId) form.append('postId', ownership.postId)
        if (ownership?.requestId) form.append('requestId', ownership.requestId)
        if (ownership?.offerId) form.append('offerId', ownership.offerId)
        if (ownership?.folder) form.append('folder', ownership.folder)

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })

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
