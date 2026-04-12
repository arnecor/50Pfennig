/**
 * lib/image/resizeImage.ts
 *
 * Client-side image resizing using the Canvas API.
 * Compresses images before upload to keep storage and bandwidth costs low.
 */

/**
 * Resizes an image blob to fit within `maxSize` pixels (both width and height)
 * and compresses it as JPEG at the given quality.
 *
 * @returns A compressed JPEG blob, typically 20–50 KB for avatar-sized images.
 */
export async function resizeImage(blob: Blob, maxSize = 256, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
