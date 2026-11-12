import { fitWithin } from "./images";

/**
 * Shrinks a photo in the browser before upload: longest side at most `max`
 * pixels, re-encoded as WebP (JPEG where the browser can't write WebP).
 * Re-encoding also strips EXIF data such as GPS location.
 */
export async function compressImage(
  file: File,
  max = 1600,
  quality = 0.85,
): Promise<{ blob: Blob; extension: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process images.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return { blob: webp, extension: "webp" };
  const jpeg = await encode("image/jpeg");
  if (jpeg) return { blob: jpeg, extension: "jpg" };
  throw new Error("This browser can't process images.");
}
