/**
 * DEVICE-ONLY CHAT MEDIA.
 *
 * Chat attachments are private conversation content, so they are not copied
 * into the platform's media storage at all. Instead they ride inside the chat
 * message document itself as a data URL: the bytes only ever exist on the two
 * participants' devices and inside their conversation, they disappear when the
 * conversation is deleted, and they never touch the media engine or a bucket.
 *
 * Firestore caps a document at 1 MiB, which caps what can ride along: the
 * base64 form of a blob is ~4/3 of its size, so anything at or under
 * `MAX_CHAT_EMBED_BYTES` fits comfortably alongside the rest of the message.
 * Larger videos/files still go through the regular upload pipeline — they
 * physically cannot fit in a document.
 */

/** Raw bytes that still fit a chat document once base64-encoded (~870 KB of base64). */
export const MAX_CHAT_EMBED_BYTES = 650 * 1024;

/** Longest edge kept for a chat photo; plenty for a phone screen, small enough to embed. */
const MAX_IMAGE_EDGE = 1280;
const IMAGE_QUALITIES = [0.75, 0.6, 0.45];

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened.'));
    };
    img.src = url;
  });
}

/**
 * Downscale and re-encode an image until its base64 form fits in a chat
 * document. Throws when even the smallest quality is too large.
 */
export async function compressImageForChat(
  file: File,
): Promise<{ dataUrl: string; bytes: number }> {
  const img = await loadImageElement(file);
  const longestEdge = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is not available on this device.');
  context.drawImage(img, 0, 0, width, height);

  for (let i = 0; i < IMAGE_QUALITIES.length; i += 1) {
    const quality = IMAGE_QUALITIES[i];
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('That image could not be processed.');
    if (blob.size <= MAX_CHAT_EMBED_BYTES) {
      return { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
    }
    if (i === IMAGE_QUALITIES.length - 1) {
      throw new Error('That image is too large to send in chat.');
    }
  }

  throw new Error('That image is too large to send in chat.');
}
