"use client";

import { setTheme, useTheme, type Theme } from "@/lib/theme";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

function Icon({ theme }: { theme: Theme }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" {...common}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </svg>
  );
}

/** Cycles System → Light → Dark. The choice is remembered on this device. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-card"
      aria-label={`${LABEL[theme]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={`${LABEL[theme]} (click for ${next})`}
      data-theme-choice={theme}
    >
      <Icon theme={theme} />
    </button>
  );
}
