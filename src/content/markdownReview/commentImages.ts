/** Maximum size reserved for one image data URL inside a GitHub comment. */
export const MAX_COMMENT_IMAGE_CHARS = 48_000;

const MAX_IMAGE_DIMENSION = 1280;
const MIN_IMAGE_DIMENSION = 160;
const JPEG_QUALITIES = [0.82, 0.68, 0.54, 0.4];

/**
 * Convert a pasted bitmap to a reasonably sized JPEG data URL.
 * The dimensions and quality are reduced until the serialized image fits the
 * supplied comment-body budget.
 * @param file - Pasted image file.
 * @param maxChars - Maximum allowed data URL character count.
 * @returns Compressed JPEG data URL.
 */
export async function compressCommentImage(
  file: Blob,
  maxChars = MAX_COMMENT_IMAGE_CHARS,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / longestSide);
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));

    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot resize pasted images.");

      // JPEG has no alpha channel. A white background keeps transparent PNGs
      // readable instead of turning transparent pixels black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of JPEG_QUALITIES) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= maxChars) return dataUrl;
      }

      if (Math.max(width, height) <= MIN_IMAGE_DIMENSION) break;
      width = Math.max(1, Math.round(width * 0.75));
      height = Math.max(1, Math.round(height * 0.75));
    }
  } finally {
    bitmap.close();
  }

  throw new Error("The pasted image is still too large for a GitHub comment.");
}

/**
 * Read bitmap files from a paste event.
 * @param event - Browser paste event.
 * @returns Pasted image files, excluding non-image clipboard entries.
 */
export function pastedImageFiles(event: ClipboardEvent): File[] {
  return [...(event.clipboardData?.files ?? [])].filter((file) =>
    file.type.toLowerCase().startsWith("image/"),
  );
}
