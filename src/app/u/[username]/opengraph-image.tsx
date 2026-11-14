import { ImageResponse } from "next/og";
import { isConfigured } from "@/lib/env";
import { OG_COLORS, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { getProfilePage } from "@/lib/server-queries";
import { getSkill } from "@/lib/skills";

export const alt = "A maker's profile on Flexit";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const page = isConfigured ? await getProfilePage(username).catch(() => null) : null;
  const name = page?.profile.display_name ?? "Flexit";
  const flexes = page?.skills.reduce((sum, s) => sum + s.total, 0) ?? 0;
  const fontSize = name.length > 30 ? 64 : name.length > 18 ? 80 : 96;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontFamily: "Anybody", fontSize, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            {name}
          </div>
          {page?.profile.headline && (
            <div style={{ display: "flex", fontSize: 38, color: OG_COLORS.muted }}>{page.profile.headline}</div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {(page?.skills ?? []).slice(0, 4).map(({ slug, total }) => {
              const skill = getSkill(slug);
              return (
                <span
                  key={slug}
                  style={{
                    display: "flex",
                    padding: "8px 20px",
                    borderRadius: 999,
                    background: `hsl(${skill.hue} 55% 42%)`,
                    color: "#fff",
                    fontSize: 26,
                    fontWeight: 600,
                  }}
                >
                  {skill.name} · {total}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30 }}>
          <span style={{ color: OG_COLORS.muted }}>{page ? `@${page.profile.username}` : ""}</span>
          {page && (
            <span style={{ color: OG_COLORS.muted }}>
              {flexes} {flexes === 1 ? "flex" : "flexes"} · {page.followers} {page.followers === 1 ? "follower" : "followers"}
            </span>
          )}
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
