import { SUPABASE_URL } from "./env";

export type Bucket = "post-images" | "avatars";

/** Public URL for an object in one of the public buckets. */
export function publicImageUrl(bucket: Bucket, path: string | null | undefined) {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * The small copy uploaded next to every flex photo for feed cards
 * ("abc.webp" → "abc-sm.webp"). Cards fall back to the full photo when it's missing.
 */
export function thumbPath(path: string) {
  return path.replace(/\.(webp|jpe?g|png)$/, "-sm.$1");
}

/** Longest side of the full photo and of the card-sized copy, in pixels. */
export const FULL_SIZE = 1600;
export const THUMB_SIZE = 800;

/** Scales width × height down to fit inside a square of `max`, keeping the ratio. */
export function fitWithin(width: number, height: number, max: number) {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Random, URL-safe file name inside the user's own folder. */
export function imagePath(userId: string, extension: "webp" | "jpg" = "webp") {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
  return `${userId}/${id}.${extension}`;
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
