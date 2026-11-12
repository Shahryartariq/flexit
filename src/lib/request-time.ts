import "server-only";

/**
 * Time of this server render, handed to client components so "5 min ago"
 * matches between the server HTML and the first client render.
 * Server components render once per request, so reading the clock here is fine.
 */
export function requestTime() {
  return Date.now();
}
