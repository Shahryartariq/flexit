import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { SKILLS } from "@/lib/skills";

export const alt = "Flexit: made something? Flex it.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontFamily: "Anybody", fontSize: 104, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>
            Made something?
          </div>
          <div style={{ display: "flex", fontFamily: "Anybody", fontSize: 104, fontWeight: 800, lineHeight: 0.95, color: OG_COLORS.accent, letterSpacing: -3 }}>
            Flex it.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 26, fontWeight: 600 }}>
          {SKILLS.slice(0, 7).map((skill) => (
            <span
              key={skill.slug}
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: 999,
                background: `hsl(${skill.hue} 75% 88%)`,
                color: `hsl(${skill.hue} 55% 25%)`,
              }}
            >
              {skill.name}
            </span>
          ))}
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
