export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M9 21.5 15 15.5l3.5 3.5L24 13.5M19.5 13.5H24V18"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="display hidden text-[1.35rem] font-extrabold lowercase min-[400px]:inline">flexit</span>
    </span>
  );
}
