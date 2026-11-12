import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" }[]> | undefined;

/** Fonts for share images (Satori needs WOFF/TTF, not WOFF2). */
export function ogFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/og/anybody-800.woff")),
    readFile(join(process.cwd(), "src/assets/og/instrument-400.woff")),
    readFile(join(process.cwd(), "src/assets/og/instrument-600.woff")),
  ]).then(([display, regular, semibold]) => [
    { name: "Anybody", data: display, weight: 800 as const, style: "normal" as const },
    { name: "Instrument Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Instrument Sans", data: semibold, weight: 600 as const, style: "normal" as const },
  ]);
  return fonts;
}

export const OG_COLORS = {
  paper: "#f6f4ee",
  ink: "#17150f",
  muted: "#6b665b",
  accent: "#ff5a1f",
  pop: "#d6f53d",
};

/** Share-card frame: brand mark top-left, address bottom-right. */
export function OgFrame({ children, background = OG_COLORS.paper }: { children: React.ReactNode; background?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        background,
        color: OG_COLORS.ink,
        fontFamily: "Instrument Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="52" height="52" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="9" fill={OG_COLORS.accent} />
          <path
            d="M9 21.5 15 15.5l3.5 3.5L24 13.5M19.5 13.5H24V18"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontFamily: "Anybody", fontSize: 40, fontWeight: 800 }}>flexit</span>
      </div>
      {children}
    </div>
  );
}
