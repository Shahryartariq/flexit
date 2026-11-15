/** Serialises structured data for a <script type="application/ld+json"> tag without letting text close the tag. */
export function toJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
