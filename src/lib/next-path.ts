/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(raw: string | null | undefined, fallback = "/") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
