import { publicImageUrl } from "@/lib/images";

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-24 text-3xl sm:size-28" } as const;

/** Profile photo, or the person's initials on a colour picked from their username. */
export function Avatar({
  name,
  username,
  path,
  size = "md",
}: {
  name: string;
  username: string;
  path: string | null;
  size?: keyof typeof SIZES;
}) {
  const url = publicImageUrl("avatars", path);
  const classes = `${SIZES[size]} shrink-0 rounded-full object-cover ring-1 ring-line`;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- already resized on upload
    return <img src={url} alt="" className={classes} loading="lazy" decoding="async" />;
  }
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`${classes} inline-flex items-center justify-center font-bold`}
      style={{ background: `oklch(0.86 0.09 ${hash})`, color: `oklch(0.3 0.08 ${hash})` }}
    >
      {initials || "?"}
    </span>
  );
}
