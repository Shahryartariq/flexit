/**
 * Only allow same-site relative paths as post-login destinations.
 * Browsers drop tabs and newlines inside URLs and treat "\" like "/", so
 * "/\t/evil.example" or "/\\evil.example" would leave the site; those are refused.
 */
export function safeNext(raw: string | null | undefined, fallback = "/") {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw) || raw.startsWith("//")) return fallback;
  try {
    const base = "https://flexit.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
